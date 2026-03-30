#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logos = {
  'minimal': 'stealthvault-logo-minimal.svg',
  'hexagon': 'stealthvault-logo-alt.svg',
  'crystal': 'stealthvault-logo-crystal.svg',
  'eye': 'stealthvault-logo-eye.svg',
  'current': 'stealthvault-logo.svg'
};

const variant = process.argv[2];

if (!variant || !logos[variant]) {
  console.log('Usage: node switch-logo.js <variant>');
  console.log('Available variants:');
  Object.keys(logos).forEach(key => {
    console.log(`  ${key}: ${logos[key]}`);
  });
  process.exit(1);
}

const publicDir = path.join(__dirname, 'public');
const targetFile = path.join(publicDir, 'stealthvault-logo.svg');
const sourceFile = path.join(publicDir, logos[variant]);

if (!fs.existsSync(sourceFile)) {
  console.error(`Source file ${logos[variant]} not found!`);
  process.exit(1);
}

// Copy the selected variant to the main logo file
fs.copyFileSync(sourceFile, targetFile);
console.log(`✅ Switched to ${variant} logo variant`);
console.log(`📁 Using: ${logos[variant]}`);