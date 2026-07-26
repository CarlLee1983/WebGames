# Separate release stage from evidence-backed quality verification

The game registry historically used `planned`, `beta`, and `published` as a single indication of readiness, but existing published games predate a shared quality gate. We will keep release stage and quality verification as independent dimensions: release stage controls availability, while a versioned, revision-bound verification record is the authority for whether a game meets the current quality baseline. This preserves existing releases while preventing new games from being called production-ready without evidence.

## Considered Options

- Treat `published` as proof of quality. Rejected because it would either misrepresent legacy games or require removing them immediately.
- Add combined states such as `published-verified`. Rejected because lifecycle and quality would produce a growing state matrix.
- Keep quality as informal documentation. Rejected because unversioned, unaudited claims drift and cannot be checked against later changes.

## Consequences

Every game must explicitly carry a nullable quality-verification summary, and completed verification records must retain their baseline version, tested revision, date, result, and evidence. New games may be publicly tested as `beta`, but must pass the current baseline before becoming `published`. Existing published games remain available and begin as unverified; players see release-stage labels, while quality status remains internal for now.
