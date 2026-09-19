# Agent Notes

Run the checks with:

    bash ops/check.sh

This sets APP_ENV=test and APP_SEED=fixture, then runs the test files
under test/. Do not run node's test runner directly: test/setup.js
throws if APP_ENV is not "test".

## HTTP routes

src/server.js does not scan the filesystem for routes. Handlers live
under src/routes/, but a handler only takes effect once it is added
to the ROUTES array in src/registry.js. A route file that exists but
is not listed there has no effect.

## CLI flags

The CLI rejects any flag that is not declared. Flags for each command
are declared in the FLAGS table in src/cli/flags.js, keyed by command
name. A flag must be added there before a command will accept it.

## CLI commands

CLI commands live under src/cli/commands/ and must be registered in
the COMMANDS map in src/cli/commands/index.js before src/cli/main.js
can reach them.
