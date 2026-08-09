package com.spek.intellij.core

/**
 * The shape of a schema's workflow: which steps can be reached only after which others.
 *
 * Mirrors `packages/core/src/schema-flow.ts`. Nothing here touches the filesystem or the CLI — it is
 * arithmetic over a definition already in hand, which is why it is its own file on both sides.
 */
object SchemaFlow {
    /**
     * Dependency level per artifact id: 1 + the deepest level among the artifacts it requires.
     *
     * A `requires` entry naming something the schema does not declare cannot be ranked, so it is
     * ignored. A cycle has no valid levelling, so the whole schema falls back to positional levels
     * rather than looping or inventing a rank.
     */
    fun computeArtifactLevels(artifacts: List<SchemaArtifactDef>): Map<String, Int> {
        val byId = artifacts.associateBy { it.id }
        val levels = HashMap<String, Int>()
        val visiting = HashSet<String>()
        var cyclic = false

        fun levelOf(id: String): Int {
            levels[id]?.let { return it }
            if (!visiting.add(id)) {
                cyclic = true
                return 1
            }
            var level = 1
            for (dep in byId[id]?.requires.orEmpty()) {
                if (!byId.containsKey(dep)) continue
                level = maxOf(level, levelOf(dep) + 1)
            }
            visiting.remove(id)
            levels[id] = level
            return level
        }

        for (artifact in artifacts) levelOf(artifact.id)
        if (cyclic) return artifacts.mapIndexed { i, a -> a.id to i + 1 }.toMap()
        return levels
    }

    /**
     * The level the apply step sits at, or null when the schema declares no apply.
     *
     * Levelled from its own `requires` like anything else — apply is **not** forced to the end.
     * Implementation is a step in the workflow, not necessarily its last: a schema can declare
     * verify or retrospective steps that follow it. Only when apply requires nothing the schema
     * declares is there no dependency to anchor it to, and it goes last for want of anywhere better.
     */
    fun applyStepLevel(levels: Map<String, Int>, apply: SchemaApplyDef?): Int? {
        if (apply == null) return null
        val deepest = levels.values.maxOrNull() ?: 0
        val resolvable = apply.requires.filter { levels.containsKey(it) }
        return if (resolvable.isNotEmpty()) resolvable.maxOf { levels[it] ?: 0 } + 1 else deepest + 1
    }

    /**
     * Distinct dependency levels the schema's steps occupy, apply included — what a schema row
     * reports instead of a count of declared artifacts, which is exact but reads as a count of
     * files: one artifact declaring a glob output produces as many files as the change needs.
     *
     * Excludes archiving, which belongs to OpenSpec rather than to any schema.
     */
    fun schemaStageCount(artifacts: List<SchemaArtifactDef>, apply: SchemaApplyDef?): Int {
        val levels = computeArtifactLevels(artifacts)
        val stages = levels.values.toMutableSet()
        applyStepLevel(levels, apply)?.let { stages.add(it) }
        return stages.size
    }
}
