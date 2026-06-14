#!/usr/bin/env node
/**
 * fix-ts-underscore-vars-v2.mjs
 * Comprehensive fix for all underscore-alias TS2339 patterns.
 * Pattern: `const { _foo }` where `_foo` doesn't exist but `foo` does.
 */

import fs from 'fs';
import path from 'path';

const ROOTS = [
  'C:\\Users\\intel\\blackbox\\khepra protocol\\src',
  'C:\\Users\\intel\\blackbox\\PQC-Khepra-MCP\\src',
];

function walk(dir) {
  const files = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...walk(full));
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        files.push(full);
      }
    }
  } catch {}
  return files;
}

// All the known underscore patterns and their real names
const UNDERSCORE_ALIASES = [
  '_data',          // supabase response
  '_user',          // useAuth
  '_hasRole',       // useUserRoles
  '_toast',         // useToast
  '_profile',       // useProfile
  '_currentOrganization', // useOrganization
  '_analytics',     // useWorkflowAnalytics
  '_library',       // useIntegrations
  '_loading',       // useIntegrations, general
  '_trialStatus',   // useTrial
  '_validateSecurityAccess', // useSecurityClearance
  '_hasAccess',     // useSecurityClearance
];

let totalFixes = 0;
let totalFiles = 0;

for (const ROOT of ROOTS) {
  const files = walk(ROOT);
  
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    let fixes = 0;

    for (const alias of UNDERSCORE_ALIASES) {
      const realName = alias.slice(1); // strip leading _
      
      // Pattern 1: `{ _foo, ` → `{ foo: _foo, `
      const re1 = new RegExp(`\\{ ${alias}, `, 'g');
      if (re1.test(content)) {
        content = content.replace(re1, `{ ${realName}: ${alias}, `);
        fixes++;
      }
      
      // Pattern 2: `, _foo }` → `, foo: _foo }`
      const re2 = new RegExp(`, ${alias} \\}`, 'g');
      if (re2.test(content)) {
        content = content.replace(re2, `, ${realName}: ${alias} }`);
        fixes++;
      }
      
      // Pattern 3: `{ _foo }` alone → `{ foo: _foo }`
      const re3 = new RegExp(`\\{ ${alias} \\}`, 'g');
      if (re3.test(content)) {
        content = content.replace(re3, `{ ${realName}: ${alias} }`);
        fixes++;
      }
      
      // Pattern 4: trailing `_foo }` at end of line after other props
      const re4 = new RegExp(`(\\{[^}]+), ${alias} \\}`, 'g');
      if (re4.test(content)) {
        content = content.replace(re4, (m, pre) => `${pre}, ${realName}: ${alias} }`);
        fixes++;
      }
    }

    if (fixes > 0 && content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      totalFixes += fixes;
      totalFiles++;
      console.log(`  fixed ${fixes}x: ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(`\nDone: ${totalFixes} total substitutions in ${totalFiles} files`);
