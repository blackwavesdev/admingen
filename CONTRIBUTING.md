# 🌊 Contributing to AdminGen

First off, thank you for considering contributing! We're excited to build this framework with the community.

This document provides guidelines for contributing to AdminGen to ensure a smooth and effective process for everyone.

## 📜 Code of Conduct

This project and everyone participating in it is governed by the [AdminGen Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## 🐞 How to Report a Bug

If you find a bug, please [open a new issue](https://github.com/blackwavesdev/admingen/issues/new) and provide the following:

* **A clear title** describing the issue.
* **Your environment:** What version of Bun, Elysia, and `@blackwaves/admingen` are you using?
* **Steps to Reproduce:** Provide a clear, step-by-step list of actions to reproduce the bug.
* **Expected Behavior:** What did you expect to happen?
* **Actual Behavior:** What actually happened? (Include console logs, error messages, and screenshots if possible).

## ✨ How to Suggest a Feature

We'd love to hear your ideas!

1.  **Check for existing issues:** Make sure your idea hasn't already been suggested.
2.  **Open an issue:** If not, [open a new issue](https://github.com/blackwavesdev/admingen/issues/new) to discuss the feature.
3.  **Discuss:** We'll discuss the proposal, its scope, and how it fits into the project's roadmap. This saves everyone time and ensures new features are aligned with the project's goals.

## 🛠️ Local Development Setup

Ready to write some code? Here’s how to set up your local development environment.

1.  **Fork & Clone:**
    * Fork the repository to your own GitHub account.
    * Clone your fork to your local machine:
        ```bash
        git clone [https://github.com/YOUR-USERNAME/admingen.git](https://github.com/YOUR-USERNAME/admingen.git)
        cd admingen
        ```

2.  **Install Dependencies:**
    * This is a Bun-based monorepo. All commands should be run from the **root** folder.
    * This single command installs all dependencies for all packages and links them together.
        ```bash
        bun install
        ```

3.  **Run the Local Build:**
    * Our project uses TypeScript and must be built. The root `build` script handles the complex build order for all packages.
    * Before you start developing, run a full build to make sure everything is linked correctly.
        ```bash
        bun run build
        ```

4.  **Run the Test App:**
    * The `example-app` is the best way to test your changes live.
    * This requires two terminals running at the same time:
        * **Terminal 1 (Backend API):**
            ```bash
            cd example-app
            bun run dev
            ```
        * **Terminal 2 (Frontend UI):**
            ```bash
            cd packages/ui
            bun run dev
            ```
    * Now, open **`http://localhost:5173`** (or whatever port your UI server starts on) in your browser. This is your test environment.

## 🚀 Submitting a Pull Request

1.  **Create a branch:** Create a new branch for your feature or bugfix from the `main` branch.
    ```bash
    git checkout -b feature/my-awesome-fix
    ```

2.  **Make your changes:** Write your code.

3.  **Test your changes:**
    * Ensure your code works in the `example-app`.
    * **This is critical:** Run a full production build from the root to make sure you haven't broken the build pipeline.
        ```bash
        bun run build
        ```

4.  **Commit and Push:**
    * Commit your changes with a clear message.
    * Push your branch to your fork:
        ```bash
        git push origin feature/my-awesome-fix
        ```

5.  **Open a Pull Request:**
    * Go to the `blackwavesdev/admingen` repository on GitHub.
    * Click "Compare & pull request".
    * Fill out the template, linking to any relevant issues.

6.  **Review:**
    * Our `main` branch is protected. Your PR must be reviewed and all status checks (like our "Build and Test PRs" action) must pass before it can be merged.
    * We will review your code, provide feedback, and merge it once it's ready.

Thank you for contributing!