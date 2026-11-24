## Description
<!-- This section should be a couple of sentences describing what you changed and why you changed it. -->

<!-- Replace this line with a description of your changes. -->
I changed X and Y to accomplish Z.

<!-- Replace "XXX" with the relevant GitHub Issue number. -->
<!-- If this PR is not related to an issue, replace the `#XXX` with "N/A" and say where the work came from. -->
This PR resolves #XXX.


## Areas Affected
<!-- List every project or repo path this PR changes. -->

- `areas/<kind>/<project>/`


## Change Details
Here's what I changed:

<!-- Add a bullet point for each concrete change you made. -->
- Changed A
- Added B

Here's what my changes affect:

<!-- Mention any breaking changes or anything that needs to be done after merging. If nothing does, write "None." -->

- Renaming X in project A breaks project B until B is updated.
- After merging, Y needs to be redeployed to pick up the new config.


## Developer Testing
<!-- This section should be longer and more comprehensive than the next one. Make sure to test your changes thoroughly. -->

**Environment:** <!-- Replace this comment with whatever could affect your results, such as your OS, toolchain versions, and build mode, e.g. "macOS 15, Go 1.24, release build". -->

Here's what I did to test my changes:

<!-- Add a couple of bullet points about how you tested your changes, including the exact commands you ran and their results. -->
<!-- Put long output in a <details> block. -->
<!-- For UI changes, also add before and after screenshots, in a <details> block. -->

- Ran A
- Ran B
- Ran C


## Reviewer Testing
<!-- This section shouldn't be that long. Just include some quick tests that reviewers can easily run. -->

Here's what you should do to quickly validate my changes:

<!-- Add some steps reviewers can take to test your changes, along with the expected result of each. -->
<!-- For UI changes, mention the desired effect that was recorded in your testing ("Developer Testing"). -->

- Run D and check output/effect E.


## Workflow Checklist
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
