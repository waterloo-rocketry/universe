# Contributing to Launch App

Welcome! This guide takes you from installing the tools to opening your first
pull request (PR). Read the [README](README.md) for the application's architecture
and development commands.

## 1. Install the tools

- Create a [GitHub account](https://github.com/signup). Ask the software lead for
  access to Waterloo Rocketry's repositories if you cannot clone or push.
- Install [Git](https://git-scm.com/downloads/), which tracks changes to your code.
  GitHub's [Git setup guide](https://docs.github.com/en/get-started/git-basics/set-up-git)
  also explains authentication. For HTTPS, use Git Credential Manager or follow
  GitHub's authentication instructions; your GitHub password does not authenticate
  Git pushes.
- Install **Node.js 24**, matching the root `.nvmrc`. Node runs JavaScript tools;
  **npm** installs dependencies and runs project scripts. npm comes with Node;
  see the [Node/npm installation guide](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/).
  You do not need an npm account to work on this app.
- Use a code editor and a terminal. The commands below work in Git Bash on
  Windows and typical macOS/Linux shells. PowerShell also works; if it blocks
  `npm.ps1`, use `npm.cmd` in place of `npm`.

A Node version manager makes it easier to switch versions between projects:

- **Windows:** follow the [nvm-windows installation instructions](https://github.com/nvm-windows/nvm).
  Then run `nvm install 24` and `nvm use 24` (use an elevated terminal if required
  by nvm-windows). Follow its guidance if you already have Node installed.
- **macOS/Linux:** follow the [nvm installation instructions](https://github.com/nvm-sh/nvm#installing-and-updating).
  Then run `nvm install 24` and `nvm use 24`. In the repository root, `nvm install`
  and `nvm use` can also read `.nvmrc`.

Alternatively, install the Node 24 release from the
[Node.js downloads page](https://nodejs.org/en/download). Reopen your terminal
after installing tools and confirm they are available:

```sh
git --version
node --version
npm --version
```

Node should report `v24.x.x`. Configure the identity Git records on your commits
once, replacing these examples with your name and an email associated with your
GitHub account (a GitHub noreply email is also fine):

```sh
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## 2. Clone and check out the repository

Launch App is developed in the standalone
[launch-app repository](https://github.com/waterloo-rocketry/launch-app). Open
pull requests against `main`.

From a directory where you want to store your projects:

```sh
git clone https://github.com/waterloo-rocketry/launch-app.git
cd launch-app
git checkout main
git pull --ff-only origin main
npm install
```

`clone` downloads the repository, `cd` changes directories, `checkout` selects a
branch, and `pull` brings in changes from GitHub. `--ff-only` stops rather than
creating an unexpected merge if your local branch has diverged.

If you already have a clone of the standalone launch-app repository, use that
copy: check `git status`, finish or save any in-progress work, then fetch and
check out `main`:

```sh
git fetch origin
git checkout main
git pull --ff-only origin main
npm install
```

Run this example from the repository root. Do not clone again for each task.

Run all npm commands from the root of this standalone repository, which contains
`package.json` and `package-lock.json`.

## 3. Start the application

From the repository root:

```sh
npm run dev
```

This starts Vite and opens the Electron application. Renderer changes refresh
automatically. Restart this command after changing Electron main, preload, or
shared code used by the main process. Close Electron or press Ctrl+C in the
terminal to stop development. Open developer tools with Ctrl+Shift+I
(Cmd+Option+I on macOS).

The app currently uses fake data for development and has no backend telemetry or
Omnibus integration. To try the mock connection, open two terminals, both in
the repository root:

```sh
# Terminal 1
npm run mock:server
```

```sh
# Terminal 2
npm run dev
```

The UI shows **connected to mock** after receiving data. The mock server uses
`127.0.0.1:6768`; production builds do not connect to it. See the
[mock data guide](docs/mock-data.md) for fixtures, server options, and protocol.

If a command fails, first check your current directory and Node version. Run
`npm install` again after pulling dependency changes. If the mock server reports
that its port is already in use, check whether another mock server is running.

## 4. Choose a task and create a branch

Find a task in the
[software issue tracker](https://github.com/waterloo-rocketry/2026-2027-software-issues).
Coordinate with the software lead or issue author, assign yourself when you take
the task, and update its project status as work progresses. Ask for context if an
issue is unclear.

Start each task from an updated `main`. Run these Git commands from anywhere
inside the repository, after committing or saving any existing work:

```sh
git checkout main
git pull --ff-only origin main
git checkout -b jsmith/157-add-status-panel
```

`checkout -b` creates and switches to a new branch. Rocketry generally names
branches **`watiam-id/short-description`**, or
**`watiam-id/issue-number-short-description`** when there is an issue. Use your
WatIAM ID (the username before `@uwaterloo.ca`), not the example `jsmith`. Keep
the description short, lowercase, and separated by hyphens. For example:

- `jsmith/157-add-status-panel`
- `jsmith/update-contributing`

To return to an existing local branch, use
`git checkout jsmith/157-add-status-panel`. To check out someone else's branch
for the first time:

```sh
git fetch origin
git checkout --track origin/jsmith/157-add-status-panel
```

Work on your task branch and open a PR to merge into `main`.

## 5. Make and check changes

- Keep each PR focused on one task. Follow the surrounding TypeScript and React
  patterns, and update documentation when behavior or setup changes.
- Add or update tests for changed behavior. The [README](README.md#architecture)
  explains where main, preload, renderer, and shared code belong.
- Preserve the Electron security boundary: the renderer has no direct Node.js
  access. Expose narrow preload APIs when needed; keep context isolation and
  sandboxing enabled.
- Keep dependency changes intentional. If you add or update a dependency, commit
  this app's `package.json` and `package-lock.json` together. Do not commit
  `node_modules`, `dist`, credentials, or unrelated generated changes.

Before pushing, run these commands from the repository root:

```sh
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Review any formatting changes, and manually try the behavior you changed with
`npm run dev`. To test the built application, run `npm run start` after the build.
The build does not create an installer.

Review and commit your work. These examples assume you are in the app folder:

```sh
git status
git diff
git add src/renderer/components/YourComponent.tsx
git diff --staged
git commit -m "Add launch status panel"
git push -u origin jsmith/157-add-status-panel
```

Replace the example path with the files you actually changed; stage each intended
file, including tests or docs. `git diff --staged` shows exactly what the commit
will contain. Use a clear commit message describing the change. `-u` connects your
local branch to the remote branch; subsequent commits only need `git push`.

## 6. Open a pull request

1. Open the repository's [compare page](https://github.com/waterloo-rocketry/launch-app/compare)
   or use GitHub's **Compare & pull request** prompt after pushing.
2. Select **base: `main`** and **compare: your branch**. Check the **Files changed**
   tab for unintended changes.
3. Give the PR a clear title and describe the problem, what changed, and how you
   tested it. Include screenshots for visible UI changes. Use a draft PR if you
   want feedback while work is still in progress.
4. Link the issue. Because issues live in a separate repository, use the full
   reference, for example `Closes waterloo-rocketry/2026-2027-software-issues#157`.
5. Assign yourself and request a review from the software lead or a relevant team
   member. Move the issue to the project's review status when it is ready.
6. Address review feedback by committing and pushing to the same branch; the PR
   updates automatically. Re-run the relevant checks after making changes.

Run the local checks above before requesting review, and ensure any configured
CI checks pass before merging.
Once reviewed, approved, and passing, use **Squash and merge**,
following the team's review process. Delete the merged branch on GitHub and
update your local base branch before starting the next task:

```sh
git checkout main
git pull --ff-only origin main
```

If you hit an authentication error, merge conflict, or unfamiliar Git message,
share the command and error with a teammate. Keep your work saved and ask before
using commands that discard changes or rewrite a shared branch's history.
