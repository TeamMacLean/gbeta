# gBeta — Pilot: Try This

Thanks for kicking the tyres on **gBeta**. It's a fast, private, in-browser genome
browser you can *ask questions* of — not just pan and zoom. It's **beta**, and your
feedback is the whole point: tell us what's confusing, broken, missing, or slow.

**Open it:** https://teammaclean.github.io/gbetter/ — nothing to install, no sign-up.
Your data stays in your browser (nothing is ever uploaded).

---

## 1. Get oriented in 5 minutes (no data needed)

1. In the left sidebar, click **"New here? Load example data →"**. You land on the
   human **TP53** gene with variants sitting on it.
2. **Drag** the view to pan, **scroll** to zoom (down to single bases). Click a track
   name in the sidebar to jump to it.
3. Now the part that isn't IGV — **ask it things:**
   - **Search bar** (top): type a gene `TP53`, or coordinates `chr17:7668421-7687490`.
   - **💬 Ask AI** (bottom-right): type *"which genes here have variants?"* You get a
     **ranked, clickable list** — click a row to jump there. Then ask a follow-up:
     *"just the pathogenic ones."*
   - **GQL console** (`Cmd+\`` or the tab at the bottom): try
     ```
     SELECT GENES INTERSECT variants
     SELECT VARIANTS WHERE clin CONTAINS pathogenic
     SELECT MAX(count) GENES INTERSECT variants
     ```
     (the console turns plain-English questions into these commands, so they're
     reproducible).

> 💡 Ask AI needs a key — add one under **⚙️ Settings → AI** (Anthropic/OpenAI), or
> point it at a local **Ollama** for zero-cloud. Everything else (navigation, gene
> lookup, hand-written queries) works with no key.

---

## 2. Now your own data (10 minutes)

1. **Pick your genome** in the assembly selector (top-left). Two dozen are built in,
   including several plant pathogens (Magnaporthe, Botrytis, Puccinia, Zymoseptoria,
   Phytophthora) and the usual suspects.
2. **Load your files** — drag a `.gff3` / `.vcf` / `.bam` (+`.bai`) / `.bw` / `.bb`
   onto the window, or use the sidebar **File** tab. Remote files: the **URL** tab
   (it streams, so big remote BAMs don't download).
3. If a track shows an **amber ⚠️** next to its name, its chromosomes don't match the
   selected genome — switch to the right one and it'll appear.
4. Try the same kinds of questions on *your* data.

---

## 3. What we'd love you to notice

This is the actual test — be honest, including the unflattering bits:

- Did your data **load and render correctly**? Anything weird with chromosome names,
  big files, or unusual formats?
- Could you **get to a real answer faster** than with your usual tool?
- Where did it **confuse you, break, or surprise you**?
- What did you **expect to be able to do** that you couldn't find?

---

## 4. Tell us (the important bit)

Click the **📣 megaphone** in the top-right at any time. It opens a short report with
the technical context already filled in (your genome, view, browser — never your
data). Use it for *anything*: a bug, a confusion, a missing feature, or
"I wish it could…". Little reports are very welcome.

---

### Good to know

- **Private:** all parsing happens in your browser. AI features send only your
  question and a track *summary* (names/types) — never your sequences or variants.
- **Reproducible & shareable:** the URL captures your exact view — copy it to share.
  Save a sequence of queries as a re-runnable **Analysis** (Console → History →
  *Save analysis*), or **Export .gql**.
- **Stuck?** The [full guide](../README.md) and [tutorials](tutorials/) have more,
  but you shouldn't need them to start.
