## TL;DR
<!-- This section should be one line describing what you changed and why you changed it. -->

<!-- Replace this line with a one-line description of your changes. -->
I changed X to accomplish Y.

<!-- Replace "XXX" with the relevant GitHub Issue number. -->
<!-- If this PR is not related to an issue, replace the `#XXX` with "N/A" and say where the work came from. -->
Resolves #XXX.


## Changes
<!-- This section should describe the specific decisions you made and what changes about the system overall. Don't go line by line. -->

Here's what I changed:

<!-- Add a couple of bullet points about your decisions and changes. Make sure to call out breaking changes and any effects on other projects. -->
- Did A instead of B, because C.
- Renaming X in project A breaks project B until B is updated.

Here's what needs to be done after merging:

<!-- Add a bullet point for each action needed after merging, such as a release tag, a redeploy, or a config change. If nothing is needed, write "None." -->
- Redeploy Y to pick up the new config.


## Areas Affected
<!-- This section should list every project or repo path this PR changes. -->

- `areas/<kind>/<project>/`


## Testing & Coverage
<!-- This section should be comprehensive. Make sure to test your changes thoroughly. -->

**Environment:** <!-- Replace this comment with whatever could affect your results, such as your OS, toolchain versions, and build mode, e.g. "macOS 15, Go 1.24, release build". -->

Here's what I did to test my changes:

<!-- Add a couple of bullet points about how you tested your changes, including the exact commands you ran and their results. -->
<!-- For UI changes, also add before and after screenshots in a <details> block. -->
- Ran A
- Ran B

Here's my coverage report:

<!-- Paste the coverage report for the projects you touched. Put long output in a <details> block. -->

Here's what you should do to quickly validate my changes:

<!-- Add some quick steps reviewers can take to test your changes, along with the expected result of each. -->
<!-- For UI changes, describe what reviewers should see, matching your screenshots above. -->
- Run D and check output/effect E.


## End-to-End Demo (if applicable)
<!-- This section is important for end-to-end feature validation. If this PR doesn't need a demo, replace this section's content with "N/A." -->

Here's a demo of my changes working end to end:

<!-- Add screenshots, a recording, or logs showing your changes working across the whole system. -->


## Checklist
<!-- Go through these steps before requesting a review, and tick each one as you finish it. -->
<!-- If a step doesn't apply to this PR, tick it and add "(N/A)" at the end. -->

- [ ] My branch is up to date with `main`.
- [ ] I reviewed my own diff and removed debug code, commented-out code, and unrelated changes.
- [ ] Tests, linters, and formatters pass locally for every project I touched.
- [ ] I added or updated tests that cover my changes.
- [ ] I updated the READMEs and docs for anything whose usage or behaviour changed.
- [ ] If I changed a GitHub Actions workflow under `areas/`, I ran `uv run tools/build_ci` and included the regenerated copies.
- [ ] I didn't include any secrets, credentials, or generated/binary files.
- [ ] CI passes on this PR, and I requested reviewers.
