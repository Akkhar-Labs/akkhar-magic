/**
 * Akkhar-Magic :: CLI Interface
 * ===============================
 * Command-line utilities for managing profiles, sessions, and login.
 *
 * Commands:
 *   login              - Opens a visible browser for Google account login
 *   switch [profile]   - Switch active browser profile (identity hot-swap)
 *   status             - Show current bridge/session status
 *   profiles           - List all profiles
 *   create-profile     - Create a new browser profile
 *   sessions           - List all tracked sessions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolveConfig } from '../config.js';
import { Archivist } from '../persistence/archivist.js';
import { BrowserLauncher } from '../browser/launcher.js';
import { discoverBrowser } from '../browser/discovery.js';
import { waitForAccountEmail } from '../providers/google-ai-studio/index.js';

const program = new Command();

program
  .name('akkhar-magic')
  .description('Akkhar-Magic CLI — UI-to-API Bridge Management')
  .version('0.0.1');

// ─── login ───────────────────────────────────────────────────────

program
  .command('login')
  .description('Open a visible browser to log into Google AI Studio')
  .option('-p, --profile <name>', 'Profile to login with', 'default')
  .action(async (opts: { profile: string }) => {
    const config = resolveConfig({ headless: false });

    if (!config.executablePath) {
      const browser = discoverBrowser();
      if (!browser) {
        console.error(
          chalk.red(
            '\n✗ No Chromium browser found. Install Chrome, Brave, or Edge.\n',
          ),
        );
        process.exit(1);
      }
      config.executablePath = browser.executablePath;
      console.log(chalk.gray(`  Browser: ${browser.name}`));
    }

    const archivist = new Archivist(config);
    await archivist.initialize();

    // Switch to requested profile if different
    if (opts.profile !== archivist.getActiveProfileName()) {
      try {
        await archivist.switchProfile(opts.profile);
      } catch {
        console.log(
          chalk.yellow(`Profile "${opts.profile}" not found. Creating it...`),
        );
        await archivist.createProfile(opts.profile);
        await archivist.switchProfile(opts.profile);
      }
    }

    const launcher = new BrowserLauncher(config);
    console.log(chalk.cyan('\n✦ Opening browser for login...'));
    console.log(
      chalk.gray('  Sign into your Google account in the browser window.'),
    );
    console.log(chalk.gray('  Close the browser when done.\n'));

    const { identity: gmail } = await launcher.openLoginBrowser(
      archivist.getActiveProfileDir(),
      `${config.googleAiStudioBaseUrl}/prompts/new_chat`,
      waitForAccountEmail,
    );

    await archivist.markAuthenticated(opts.profile);

    if (gmail) {
      await archivist.setProfileGmail(opts.profile, gmail);
      console.log(chalk.green(`\n✓ Logged in as ${chalk.bold(gmail)}`));
      console.log(
        chalk.green(
          `✓ Profile "${opts.profile}" authenticated successfully!\n`,
        ),
      );
    } else {
      console.log(
        chalk.green(
          `\n✓ Profile "${opts.profile}" authenticated successfully!`,
        ),
      );
      console.log(
        chalk.yellow(
          '⚠ Could not auto-detect Gmail address. ' +
            'Persistent sessions may be limited until next login.\n',
        ),
      );
    }
  });

// ─── switch ──────────────────────────────────────────────────────

program
  .command('switch')
  .description('Switch the active browser profile (identity hot-swap)')
  .argument('<profile>', 'Profile name to switch to')
  .action(async (profileName: string) => {
    const config = resolveConfig();
    const archivist = new Archivist(config);
    await archivist.initialize();

    try {
      const profile = await archivist.switchProfile(profileName);
      console.log(chalk.green(`\n✓ Switched to profile: "${profile.name}"`));
      console.log(
        chalk.gray(`  Authenticated: ${profile.authenticated ? 'Yes' : 'No'}`),
      );
      console.log(chalk.gray(`  User data dir: ${profile.userDataDir}\n`));
    } catch (err) {
      console.error(
        chalk.red(`\n✗ ${err instanceof Error ? err.message : err}\n`),
      );
      process.exit(1);
    }
  });

// ─── status ──────────────────────────────────────────────────────

program
  .command('status')
  .description('Show current system status')
  .action(async () => {
    const config = resolveConfig();
    const archivist = new Archivist(config);
    await archivist.initialize();

    const profiles = archivist.listProfiles();
    const sessions = archivist.listSessions();
    const activeProfile = archivist.getActiveProfileName();

    console.log(chalk.cyan('\n✦ Akkhar-Magic Status'));
    console.log(chalk.gray('─'.repeat(45)));

    console.log(chalk.white(`  Server:  http://${config.host}:${config.port}`));
    console.log(chalk.white(`  Model:   ${config.modelName}`));
    console.log(
      chalk.white(`  Mode:    ${config.headless ? 'Headless' : 'Visible'}`),
    );

    console.log(chalk.cyan('\n  Profiles:'));
    for (const p of profiles) {
      const active = p.name === activeProfile ? chalk.green(' ◄ active') : '';
      const auth = p.authenticated ? chalk.green('✓') : chalk.red('✗');
      const gmail = p.gmail ? chalk.gray(` (${p.gmail})`) : '';
      console.log(chalk.white(`    ${auth} ${p.name}${gmail}${active}`));
    }

    console.log(chalk.cyan(`\n  Sessions: ${sessions.length}`));
    for (const s of sessions.slice(0, 10)) {
      const url = s.chatUrl
        ? chalk.gray(s.chatUrl.slice(0, 60))
        : chalk.gray('(no URL yet)');
      console.log(chalk.white(`    ${s.sessionId.slice(0, 8)}... → ${url}`));
    }
    if (sessions.length > 10) {
      console.log(chalk.gray(`    ... and ${sessions.length - 10} more`));
    }

    console.log('');
  });

// ─── profiles ────────────────────────────────────────────────────

program
  .command('profiles')
  .description('List all browser profiles')
  .action(async () => {
    const config = resolveConfig();
    const archivist = new Archivist(config);
    await archivist.initialize();

    const profiles = archivist.listProfiles();
    const activeProfile = archivist.getActiveProfileName();

    console.log(chalk.cyan('\n✦ Browser Profiles'));
    console.log(chalk.gray('─'.repeat(45)));

    for (const p of profiles) {
      const active = p.name === activeProfile ? chalk.green(' [ACTIVE]') : '';
      const auth = p.authenticated
        ? chalk.green('authenticated')
        : chalk.yellow('not authenticated');
      console.log(chalk.white(`\n  ${p.name}${active}`));
      console.log(chalk.gray(`    Status:    ${auth}`));
      console.log(chalk.gray(`    Gmail:     ${p.gmail ?? '(not captured)'}`));
      console.log(chalk.gray(`    Data dir:  ${p.userDataDir}`));
      console.log(chalk.gray(`    Last used: ${p.lastUsed}`));
    }
    console.log('');
  });

// ─── create-profile ──────────────────────────────────────────────

program
  .command('create-profile')
  .description('Create a new browser profile')
  .argument('<name>', 'Profile name')
  .action(async (name: string) => {
    const config = resolveConfig();
    const archivist = new Archivist(config);
    await archivist.initialize();

    try {
      const profile = await archivist.createProfile(name);
      console.log(chalk.green(`\n✓ Profile "${profile.name}" created`));
      console.log(chalk.gray(`  Data dir: ${profile.userDataDir}`));
      console.log(
        chalk.gray(
          '\n  Run `npm run login -- -p ' + name + '` to authenticate.\n',
        ),
      );
    } catch (err) {
      console.error(
        chalk.red(`\n✗ ${err instanceof Error ? err.message : err}\n`),
      );
      process.exit(1);
    }
  });

// ─── sessions ────────────────────────────────────────────────────

program
  .command('sessions')
  .description('List all tracked sessions')
  .action(async () => {
    const config = resolveConfig();
    const archivist = new Archivist(config);
    await archivist.initialize();

    const sessions = archivist.listSessions();

    console.log(chalk.cyan(`\n✦ Sessions (${sessions.length})`));
    console.log(chalk.gray('─'.repeat(60)));

    if (sessions.length === 0) {
      console.log(
        chalk.gray('  No sessions yet. Send a request to create one.\n'),
      );
      return;
    }

    for (const s of sessions) {
      console.log(chalk.white(`\n  Session: ${s.sessionId}`));
      console.log(chalk.gray(`    Profile:  ${s.profileName}`));
      console.log(chalk.gray(`    Model:    ${s.model}`));
      console.log(chalk.gray(`    Chat URL: ${s.chatUrl || '(none)'}`));
      console.log(chalk.gray(`    Created:  ${s.createdAt}`));
      console.log(chalk.gray(`    Updated:  ${s.updatedAt}`));
    }
    console.log('');
  });

// ─── Parse & Execute ─────────────────────────────────────────────

program.parse();
