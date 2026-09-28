# ADR-0009: One public Paul Loop plugin with internal modules

**Status**: accepted by the user's 2026-09-28 request to unify installation and invocation.

The original split allowed engine-only adoption, independent workflow releases and disabled-by-default
semantic memory. It also exposed internal architecture as three installations, sibling resolution and
the separate `ship-flow` name. The requested user experience is one Paul Loop installation and entry.

Ship one `paul-loop` identity and version in the Claude marketplace and generated Codex marketplace.
Keep the existing module layout and verifier implementations. Claude loads the root source package;
generated runtimes compose the same modules. Codex root entry skills link to module resources.
Use `paul-loop:` as the public namespace and a small `paul-loop` router for natural-language requests.
Preserve the existing workflow config filename and lesson storage so branding does not move user data.

Package presence must not opt into memory services. A shared hook dispatcher requires an explicit
session/plugin setting before memory hooks run; the existing database authorization, signing and
privacy controls still apply. Default engine execution suppresses semantic-memory heartbeat checks.

An independent bundle approval covers all nested modules before the project launcher/resolver returns
executable paths. Keep legacy lock support for existing installations and reject mixed identity locks.
Migration is explicit: disable old hooks, install the bundle, review one new pin and verify a fresh
session. Do not rewrite caches, enable memory, widen publisher permissions or move project artifacts.

Tradeoff: a unified release versions the whole public package. Source-root changes require a new
package version after publication; old module tags remain historical releases. The internal module
manifests preserve their legacy identities for compatibility, not independent new marketplace releases.
