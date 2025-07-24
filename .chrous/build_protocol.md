To build the project only use these commands and no other commands. Only execute in the project root
## 0. Setup the environment (only required once)
npm install

## 1. Prepare the environment and run linters typecheckrs and tests
npm run preflight


## 2. build the project
npm run build all

## Failing Builds
If a build fails: Generate the diff to the last commit in this git repository. This gives you the only sources for errors, since the last commit worked perfectly.