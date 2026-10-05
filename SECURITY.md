# Security policy

pire stores accounts, password hashes, and lesson progress, so we take reports seriously.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub:
[Report a vulnerability](https://github.com/SobshDev/pire/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get a reply
within a week. Once a fix ships, we'll credit you in the advisory unless you'd rather stay anonymous.

## Scope

In scope: the API in `api/`, the web app in `web/`, and the Docker setup in this repository.

Out of scope: the lesson specimens. They are teaching programs, and the "vulnerabilities" in them, such
as a hardcoded vault password, are there on purpose.

## Supported versions

Only the latest commit on `main` gets security fixes.
