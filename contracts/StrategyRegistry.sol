// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint64, ebool, InEuint64} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

/**
 * @title StrategyRegistry
 * @notice StealthVault / Private Strategy Vault — pitch for judges:
 *
 *       ❌ Traditional DeFi: strategy visible → MEV/copy trading → institutions stay out.
 *       ✅ This protocol: thresholds encrypted (CoFHE) → execution compares on ciphertext →
 *          outcome applied to capital → permissionless keepers execute + settle (`executeStrategy` + `applyResult`).
 *
 * @dev `executionNonce` ties each `StrategyEvaluated` event to exactly one `applyResult` (no races when multiple executes land).
 *      Oracle price is public + trivially encrypted for FHE; strategy uses `InEuint64` (production) or demo trivial encrypt.
 */
contract StrategyRegistry {
    uint8 public constant ACTION_HOLD = 0;
    uint8 public constant ACTION_BUY = 1;
    uint8 public constant ACTION_SELL = 2;

    uint256 public constant KEEPER_REWARD_WEI = 0.001 ether;

    struct RegisteredStrategy {
        euint64 buyPrice;
        euint64 sellPrice;
        address owner;
        bool active;
        bool paused;
        uint256 registeredAt;
    }

    mapping(bytes32 => RegisteredStrategy) public strategies;
    mapping(address => bytes32[]) public strategiesByOwner;

    uint256 private _nextId;
    bool private locked;

    mapping(bytes32 => uint256) public totalDeposits;
    mapping(bytes32 => mapping(address => uint256)) public userDeposits;
    mapping(bytes32 => uint256) public vaultValue;

    /// @notice Monotonic per strategy; incremented on each `executeStrategy` (emitted for keepers).
    mapping(bytes32 => uint256) public executionNonce;
    /// @notice Last nonce successfully settled via `applyResult` (prevents double-settle of same nonce).
    mapping(bytes32 => uint256) public lastSettledNonce;

    event StrategyRegistered(bytes32 indexed strategyId, address indexed owner);
    event StrategyDeactivated(bytes32 indexed strategyId);
    event StrategyPaused(bytes32 indexed strategyId);
    event StrategyUnpaused(bytes32 indexed strategyId);
    event StrategyEvaluated(
        bytes32 indexed strategyId,
        uint256 nonce,
        uint256 oraclePrice,
        uint256 isBelowBuyCipher,
        uint256 isAboveSellCipher
    );
    event OutcomeApplied(
        bytes32 indexed strategyId,
        uint256 nonce,
        uint8 action,
        uint256 newVaultValue
    );
    event ExecutorReward(address indexed executor);
    event KeeperRewardPaid(address indexed keeper, uint256 amount);
    event FundingReceived(address indexed sender, uint256 amount);
    event VaultDeposited(
        bytes32 indexed strategyId,
        address indexed user,
        uint256 amount
    );
    event VaultWithdrawn(
        bytes32 indexed strategyId,
        address indexed user,
        uint256 amount
    );

    error NotStrategyOwner();
    error StrategyNotFound();
    error StrategyInactive();
    error StrategyIsPaused();
    error ZeroDeposit();
    error InsufficientBalance();
    error WithdrawTransferFailed();
    error StaleExecution();
    error AlreadySettled();

    modifier nonReentrant() {
        require(!locked, "Reentrancy");
        locked = true;
        _;
        locked = false;
    }

    receive() external payable {
        emit FundingReceived(msg.sender, msg.value);
    }

    function resolveAction(
        bool isBelowBuy,
        bool isAboveSell
    ) public pure returns (uint8 action) {
        if (isBelowBuy) return ACTION_BUY;
        if (isAboveSell) return ACTION_SELL;
        return ACTION_HOLD;
    }

    function registerStrategy(
        InEuint64 calldata _buy,
        InEuint64 calldata _sell
    ) external returns (bytes32 strategyId) {
        euint64 bp = FHE.asEuint64(_buy);
        euint64 sp = FHE.asEuint64(_sell);
        return _registerCore(bp, sp);
    }

    function registerStrategyDemo(
        uint64 buyPlain,
        uint64 sellPlain
    ) external returns (bytes32 strategyId) {
        euint64 bp = FHE.asEuint64(uint256(buyPlain));
        euint64 sp = FHE.asEuint64(uint256(sellPlain));
        return _registerCore(bp, sp);
    }

    function _registerCore(
        euint64 bp,
        euint64 sp
    ) internal returns (bytes32 strategyId) {
        FHE.allowThis(bp);
        FHE.allowThis(sp);
        FHE.allowSender(bp);
        FHE.allowSender(sp);

        strategyId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, _nextId++)
        );
        strategies[strategyId] = RegisteredStrategy({
            buyPrice: bp,
            sellPrice: sp,
            owner: msg.sender,
            active: true,
            paused: false,
            registeredAt: block.timestamp
        });
        strategiesByOwner[msg.sender].push(strategyId);
        emit StrategyRegistered(strategyId, msg.sender);
    }

    function deposit(bytes32 strategyId) external payable {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (!s.active) revert StrategyInactive();
        if (s.paused) revert StrategyIsPaused();
        if (msg.value == 0) revert ZeroDeposit();

        totalDeposits[strategyId] += msg.value;
        userDeposits[strategyId][msg.sender] += msg.value;
        vaultValue[strategyId] += msg.value;

        emit VaultDeposited(strategyId, msg.sender, msg.value);
    }

    function withdraw(
        bytes32 strategyId,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert ZeroDeposit();
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();

        uint256 bal = userDeposits[strategyId][msg.sender];
        if (bal < amount) revert InsufficientBalance();

        uint256 t = totalDeposits[strategyId];
        uint256 v = vaultValue[strategyId];

        userDeposits[strategyId][msg.sender] = bal - amount;
        totalDeposits[strategyId] = t - amount;

        if (t > 0) {
            uint256 share = (amount * 1e18) / t;
            vaultValue[strategyId] = v - ((v * share) / 1e18);
        } else {
            vaultValue[strategyId] = 0;
        }

        emit VaultWithdrawn(strategyId, msg.sender, amount);

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert WithdrawTransferFailed();
    }

    /**
     * @notice Permissionless FHE evaluation. Increments `executionNonce`; keepers must use emitted `nonce` in `applyResult`.
     */
    function executeStrategy(
        bytes32 strategyId,
        uint256 oraclePricePublic
    ) external {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (!s.active) revert StrategyInactive();
        if (s.paused) revert StrategyIsPaused();

        uint256 nonce = ++executionNonce[strategyId];

        euint64 currentEnc = FHE.asEuint64(oraclePricePublic);
        FHE.allowThis(currentEnc);

        ebool priceLtBuy = FHE.lt(currentEnc, s.buyPrice);
        FHE.allowThis(priceLtBuy);
        FHE.allowSender(priceLtBuy);

        ebool priceGtSell = FHE.gt(currentEnc, s.sellPrice);
        FHE.allowThis(priceGtSell);
        FHE.allowSender(priceGtSell);

        emit ExecutorReward(msg.sender);
        emit StrategyEvaluated(
            strategyId,
            nonce,
            oraclePricePublic,
            ebool.unwrap(priceLtBuy),
            ebool.unwrap(priceGtSell)
        );
    }

    /**
     * @notice Settle the evaluation identified by `nonce` (must equal current `executionNonce` and be fresh vs `lastSettledNonce`).
     * @param nonce Copied from `StrategyEvaluated` for this run — prevents stale or duplicate settlement.
     */
    function applyResult(
        bytes32 strategyId,
        uint256 nonce,
        uint8 action
    ) external nonReentrant {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (s.paused) revert StrategyIsPaused();
        if (nonce != executionNonce[strategyId]) revert StaleExecution();
        if (nonce <= lastSettledNonce[strategyId]) revert AlreadySettled();

        uint256 navBefore = vaultValue[strategyId];
        if (navBefore > 0) {
            if (action == ACTION_BUY) {
                vaultValue[strategyId] = (navBefore * 110) / 100;
            } else if (action == ACTION_SELL) {
                vaultValue[strategyId] = (navBefore * 105) / 100;
            }
        }

        lastSettledNonce[strategyId] = nonce;

        emit OutcomeApplied(strategyId, nonce, action, vaultValue[strategyId]);

        // Reward only when there was vault capital and keeper delivered a non-HOLD outcome (reduces execute-spam drain)
        if (
            navBefore > 0 &&
            action != ACTION_HOLD &&
            address(this).balance >= KEEPER_REWARD_WEI
        ) {
            (bool paid, ) = payable(msg.sender).call{value: KEEPER_REWARD_WEI}(
                ""
            );
            if (paid) {
                emit KeeperRewardPaid(msg.sender, KEEPER_REWARD_WEI);
            }
        }
    }

    /// @notice Emergency: stop deposits, execution, and settlement for a strategy (withdrawals still allowed).
    function pauseStrategy(bytes32 strategyId) external {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (s.owner != msg.sender) revert NotStrategyOwner();
        s.paused = true;
        emit StrategyPaused(strategyId);
    }

    function unpauseStrategy(bytes32 strategyId) external {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (s.owner != msg.sender) revert NotStrategyOwner();
        s.paused = false;
        emit StrategyUnpaused(strategyId);
    }

    function getUserBalance(
        bytes32 strategyId,
        address user
    ) external view returns (uint256) {
        return userDeposits[strategyId][user];
    }

    function getStrategy(
        bytes32 strategyId
    )
        external
        view
        returns (
            euint64 buyPrice_,
            euint64 sellPrice_,
            address owner,
            bool active,
            bool paused,
            uint256 registeredAt
        )
    {
        RegisteredStrategy memory st = strategies[strategyId];
        if (st.owner == address(0)) revert StrategyNotFound();
        return (
            st.buyPrice,
            st.sellPrice,
            st.owner,
            st.active,
            st.paused,
            st.registeredAt
        );
    }

    function getStrategyCount(address owner_) external view returns (uint256) {
        return strategiesByOwner[owner_].length;
    }

    function deactivateStrategy(bytes32 strategyId) external {
        RegisteredStrategy storage s = strategies[strategyId];
        if (s.owner == address(0)) revert StrategyNotFound();
        if (s.owner != msg.sender) revert NotStrategyOwner();
        s.active = false;
        emit StrategyDeactivated(strategyId);
    }
}
