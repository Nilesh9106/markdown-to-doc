#!/usr/bin/env node

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  console.log(args);
}

void main();
