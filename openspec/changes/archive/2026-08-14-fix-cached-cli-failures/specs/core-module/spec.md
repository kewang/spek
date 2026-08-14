## ADDED Requirements

### Requirement: A cached CLI failure is not an answer

The core module memoises what the `openspec` CLI says. That memo SHALL distinguish an **answer** from a
**failure the next read could find gone**: an answer is retained for the cache's bounded lifetime, and
such a failure SHALL NOT be retained once it resolves, so the next read consults the CLI again rather
than being served the failure for the rest of the lifetime.

Which failures those are SHALL be decided by the reason, from one rule stated beside the reasons
themselves rather than restated per caller. A CLI that could not be reached at all, or that was cut
short by its own timeout, says nothing about the answer and its cause is routinely gone seconds later.
A CLI that ran and answered unusably — a non-zero exit with no body, or output that cannot be
parsed — is reporting the installation, and a read a second later finds it identical; that result SHALL
be retained, because re-asking costs a full process start to be told the same thing, and the surfaces
that read it re-read on every watcher event. A reason added to the failure taxonomy later SHALL be
placed on one side of this rule.

The distinction SHALL be made where it still exists, not derived by the cache from the value it was
handed. The value cannot carry it: a null schema order means both "the CLI answered and there is no
order" and "the CLI could not be reached", and a definition read reports "no such schema" both for a
name the CLI refused and for a file that could not be read. Where a value has already collapsed the two
by the time the cache is consulted, the judgement SHALL be made by the function that still holds them
apart, rather than reconstructed downstream. Every caller SHALL be required to state the judgement,
rather than inheriting a default: each existing caller made this mistake, and a default is how the next
one would make it silently.

A computation that throws SHALL be treated as a failure, for the same reason a returned failure is: a
rejection held for the lifetime hands every caller in the window an error whose cause may already be
gone.

Holding the in-flight computation SHALL be unaffected. A caller arriving while a read is running joins
it whether that read is about to succeed or fail — otherwise not remembering failures would also mean
not sharing them, and a host where the CLI is missing would spawn one process per concurrent reader.

The failures this concerns are the ones a host repairs while running — a CLI not yet on `PATH` in a host
that resolves it asynchronously at startup, the invocation timeout firing under load. Remembering one of
those for the same duration as an answer makes a repaired environment go on reporting the broken one,
with nothing on the surface to distinguish a stale answer from a settled one. The bounded lifetime
already exists because an earlier version remembered failures forever, so installing the CLI later never
took effect; this is that same rule at the scale the lifetime left behind.

#### Scenario: An unreachable CLI is retried on the next read

- **WHEN** a CLI-backed read fails because the CLI could not be reached, the CLI becomes reachable, and the same read is performed again within the cache lifetime
- **THEN** the CLI is consulted again and the second read returns the answer, rather than the remembered failure

#### Scenario: A failure that would repeat is remembered

- **WHEN** a CLI-backed read fails because the CLI ran and produced an answer that cannot be used, and the same read is performed again within the cache lifetime
- **THEN** the second read is served the same degraded result from the cache without spawning the CLI again

#### Scenario: An answer is still cached

- **WHEN** a CLI-backed read succeeds and the same read is performed again within the cache lifetime
- **THEN** the second read is served from the cache without spawning the CLI again

#### Scenario: An answer that reports nothing is still an answer

- **WHEN** the CLI runs successfully and reports that there is nothing to return
- **THEN** that result is cached like any other answer, and a repeat read within the lifetime does not spawn the CLI again

#### Scenario: Concurrent readers share a failing run

- **WHEN** two readers request the same uncached CLI answer while the first read is still running, and that read fails
- **THEN** the CLI is spawned once and both readers are answered from that single run

#### Scenario: A computation that throws is not remembered

- **WHEN** a CLI-backed read throws rather than returning a failure value, and the same read is performed again within the cache lifetime
- **THEN** the computation runs again rather than replaying the remembered rejection
