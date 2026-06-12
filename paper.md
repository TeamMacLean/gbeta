---
title: 'gBeta: an in-browser genome browser with a reproducible natural-language query interface'
tags:
  - genomics
  - genome browser
  - data visualization
  - reproducibility
  - large language models
  - TypeScript
authors:
  - name: "[Author One]"
    orcid: 0000-0000-0000-0000
    corresponding: true
    affiliation: 1
affiliations:
  - name: The Sainsbury Laboratory, University of East Anglia, Norwich, UK
    index: 1
date: 12 June 2026
bibliography: paper.bib
---

# Summary

`gBeta` is a genome browser that runs entirely in a web browser, with no
installation and no server. It loads the common genomics file formats —
intervals (BED), annotations (GFF3), signal (bedGraph, BigWig), variants (VCF)
and alignments (BAM/CRAM) — from local files or remote URLs, and renders them
interactively on an HTML canvas. Beyond navigation and visualization, `gBeta`
lets a user *query* their loaded data through a small, readable query language
(GQL) supporting filtering, overlap (intersection and containment), scoping,
sorting and simple aggregation, with results presented as a clickable list inside
the same view. A pluggable large-language-model (LLM) interface translates
plain-English questions into GQL: the generated command is shown to the user, can
be edited, and is executed and saved as a concrete, re-runnable artefact rather
than answered opaquely (\autoref{fig:example}). All file parsing is client-side;
genomic data is never transmitted, and LLM calls carry only the question and a
short summary of the loaded tracks. `gBeta` is released under the MIT licence and
is usable immediately at https://teammaclean.github.io/gbeta/.

![A plain-English question, *"which gene here has the most variants?"*, translated
by `gBeta` into the command `SELECT GENES INTERSECT cancer-variants` and answered
as a ranked, clickable list of genes by overlapping-variant count, over a
gene-annotation track and a variant track at the *TP53* locus. The browser, the
query engine and the translated command all run client-side.\label{fig:example}](docs/figures/figure1.png)

# Statement of need

Interactive genome browsers such as IGV [@igv], the UCSC Genome Browser [@ucsc]
and JBrowse 2 [@jbrowse2] are central to genomics. They are not query-incapable:
all offer search by gene or coordinate, and richer interrogation is available
through associated tools — the UCSC Table Browser [@tablebrowser] and Data
Integrator filter and intersect tracks, Ensembl BioMart [@biomart] answers complex
attribute queries, and REST APIs and scripting interfaces (IGV batch commands,
igv.js [@igvjs], JBrowse plugins) provide programmatic access. These capabilities,
however, typically sit *outside* the interactive view — in a separate interface, a
programming environment, or a query against server-hosted reference data — so
asking an ad hoc question of one's *own* loaded data, within the browser, commonly
still means visual inspection or export to a separate tool.

Independently, large language models make it attractive to ask such questions in
natural language. For scientific use this raises a reproducibility problem: a
free-text answer from an opaque model is hard to record, audit or re-run.

`gBeta` integrates these strands. It places a small query language and a
natural-language front-end inside the interactive browser, operating on the user's
own data entirely client-side, and the language model emits a transparent GQL
command — reviewed by the user and retained as the analysis artefact — rather than
an opaque result. The contribution is therefore one of *integration* rather than
of any single capability: in-browser querying, a natural-language interface, and
reproducible commands, over private client-side data. We note an honest limit:
LLM output is non-deterministic, so it is the captured command, not the
natural-language-to-GQL translation, that reproduces; surfacing the editable
command before it runs is what makes the step fixed and re-runnable. Queries,
views (encoded in the URL) and multi-step "analyses" can be shared and re-executed.

The intended users are bench and computational biologists who need to interrogate
their own annotation, variant and alignment data quickly, privately and
reproducibly — without server infrastructure, data upload, or leaving the
browser. `gBeta` is an early-stage tool released for use and feedback; it ships
with documentation, tutorials and an automated test suite, and an in-application
link (transmitting only technical metadata) gathers user reports.

# Acknowledgements

Development was assisted by AI coding tools. [Funding and contributors.]

# References
