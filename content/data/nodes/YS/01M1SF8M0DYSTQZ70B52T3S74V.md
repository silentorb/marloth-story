---
title: Society metrics for Jane Austen books
created_at: 2026-09-05T19:03:29.037Z
modified_at: 2026-09-05T19:28:55.009Z
---
> 💡The following is a ChatGPT response to this prompt:
>
> > Out of all of Jane Austen's books, Pride and Prejudice seems to have the most party feel. And I don't just mean the actual parties, but the average character count per scene. Mansfield park has a lot of scenes with young people hanging out, but it's not quite the same thing.
> >
> > Part of it is also the household size and general character count of each story.
> >
> > Pride and Prejudice seems to be the most extreme in terms of character volume—each scene is either intimate or bustling, while the other books more frequently land in the middle.
> >
> > I'd like table comparing the books social volume, with columns such as number of parties and social gatherings, household size, character count, average characters per scene.

Yes — and I think there’s a real structural basis for what you’re noticing. **Pride and Prejudice is not Austen’s largest novel in terms of named characters; Mansfield Park actually has almost twice as many.** What makes *P\&P* feel crowded is that its characters are unusually concentrated into recurring social configurations: assemblies, dinners, balls, visiting groups, militia gatherings, family parties, etc.

There’s also unusually good quantitative evidence for this. A literary-network study that manually identified every character gives these counts: *P\&P* 117 characters, versus 158 in *Sense and Sensibility*, 193 in *Emma*, and 218 in *Mansfield Park*. More interestingly, *P\&P* has **485 character-to-character connections and the highest network density of all six Austen novels** (7%, versus only 3% for *Mansfield Park*). ([UCD Research Repository](https://researchrepository.ucd.ie/bitstreams/db9e71f3-cee3-4fba-88e8-63d6a5c484da/download?utm_source=chatgpt.com "Title Authors(s) | Discovering Structure in Social Networks of 19th Century Fiction Grayson, Siobhán, Wade, Karen, Meaney, Gerardine, Rothwell, Jennie, Mulvany, Maria, Greene, Derek"))

### Austen's novels by "social volume"

The last two columns are necessarily **constructed estimates rather than objective textual statistics**, because Austen doesn't divide novels into scenes. I've treated a "scene" as a reasonably continuous social episode — a dinner, visit, walk, ball, assembly, conversation in a room, etc. — rather than simply using chapters. The party/gathering counts likewise include recurring social occasions rather than every two-person visit.

| Novel                     | Named characters\* | Core household size                     | Approx. major parties / gatherings | Typical social-scene size | Estimated avg. characters / social scene | Social "feel"                       |
| :------------------------ | :----------------- | :-------------------------------------- | :--------------------------------- | :------------------------ | :--------------------------------------- | :---------------------------------- |
| **Pride and Prejudice**   | **117**            | **7** at Longbourn                      | **\~15–18**                        | 2–12+                     | **\~5.5–6**                              | 🔥 **Very high / volatile**         |
| **Sense and Sensibility** | 158                | 3–4 at Barton Cottage                   | \~12–15                            | 2–8                       | \~4.0–4.5                                | High, but more dispersed            |
| **Mansfield Park**        | **218**            | **8–10** at Mansfield                   | \~12–16                            | 2–10                      | \~4.0–4.5                                | High, but domestically concentrated |
| **Emma**                  | 193                | 2 at Hartfield                          | **\~15–18**                        | 2–9                       | \~4.0–4.5                                | High, but village-networked         |
| **Northanger Abbey**      | 94                 | 5–6 at the Abbey                        | \~9–12                             | 2–8                       | \~4                                      | Moderate-high                       |
| **Persuasion**            | 136                | 3–4 at Kellynch / later Bath households | \~10–13                            | 2–8                       | \~3.5–4                                  | Moderate                            |

\*These are from the UCD literary-network project's unusually inclusive character counts: anyone appearing **or even being mentioned** is included, which is why they are substantially higher than conventional "principal character" lists. ([UCD Research Repository](https://researchrepository.ucd.ie/server/api/core/bitstreams/81eb2b88-2a46-43ff-8e45-3914eca10358/content?utm_source=chatgpt.com "Title Authors(s) | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings Grayson, Siobhán, Mulvany, Maria, Wade, Karen, Meaney, Gerardine, Greene, Derek --- | --- Title Publication date | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings 2016-09-21 Title Publication information | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings Grayson, Siobhán, Maria Mulvany, Karen Wade, Gerardine Meaney, and Derek Greene. “Novel2Vec: Characterising 19th Century Fiction via Word Embeddings,” September 21, 2016. Title Conference details | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings 24th Irish Conference on Artificial Intelligence and Cognitive Science (AICS'16), University College Dublin, Dublin, Ireland, 20-21 September 2016 Title Item record/more information | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings http://hdl.handle.net/10197/8360Downloaded 2026-05-04 01:06:44"))

### The really interesting comparison: *P\&P* vs. *Mansfield Park*

This is where I think your observation gets particularly strong.

| Measure               | *Pride and Prejudice* | *Mansfield Park* |
| :-------------------- | :-------------------- | :--------------- |
| Characters            | 117                   | **218**          |
| Chapters              | 61                    | 48               |
| Character connections | **485**               | 649              |
| Network density       | **7%**                | 3%               |
| Characters / chapter  | 1.9                   | 4.5              |
| Social impression     | **Crowded**           | Populous         |

The first four figures come from the network analysis; the "characters/chapter" figure is simply my calculation from those data. ([UCD Research Repository](https://researchrepository.ucd.ie/bitstreams/db9e71f3-cee3-4fba-88e8-63d6a5c484da/download?utm_source=chatgpt.com "Title Authors(s) | Discovering Structure in Social Networks of 19th Century Fiction Grayson, Siobhán, Wade, Karen, Meaney, Gerardine, Rothwell, Jennie, Mulvany, Maria, Greene, Derek"))

And this gets at the distinction you're making.

**Mansfield Park has more people. Pride and Prejudice has more** ***social compression*****.**

In *Mansfield Park*, there are enormous numbers of peripheral people: naval acquaintances, servants, neighbors, relatives, friends of Tom, people associated with the Prices, people associated with the Crawfords, etc. The researchers actually remark that a visualization containing all **218** characters becomes unwieldy. ([The Sea of Books](https://theseaofbooks.com/2017/07/04/jane-austens-social-networks/ "Jane Austen’s Social Networks – The Sea of Books"))

But the narrative repeatedly contracts back to the Mansfield household. Even the great social events tend to feel like **a relatively stable group of young people occupying one large house**.

*P\&P*, by contrast, keeps throwing its characters into new combinations:

* Bennets + Bingleys
* Bennets + Lucases
* Elizabeth + Collins + Lucas family
* Meryton society + militia
* Netherfield dinner parties
* Netherfield ball
* Philips household gatherings
* Rosings: Elizabeth + Darcy + Fitzwilliam + Lady Catherine
* Pemberley: Elizabeth + Gardiners + Darcy + Georgiana
* Lydia's wedding circle
* etc.

So you get this peculiar rhythm:

> **2 people → 5 people → 12 people → 3 people → 8 people → 2 people → 15 people...**

That's much closer to what we might call a **party novel**.

### Why *P\&P* feels more "bustling" despite having fewer characters

The network numbers are especially revealing.

*P\&P* has only **117** characters, but **485 connections**. That's an average of roughly **4.15 connections per character** in the raw network, compared with about **2.98** for *Mansfield Park*. More importantly, the graph's density is **more than twice as high**: 7% versus 3%. ([UCD Research Repository](https://researchrepository.ucd.ie/bitstreams/db9e71f3-cee3-4fba-88e8-63d6a5c484da/download?utm_source=chatgpt.com "Title Authors(s) | Discovering Structure in Social Networks of 19th Century Fiction Grayson, Siobhán, Wade, Karen, Meaney, Gerardine, Rothwell, Jennie, Mulvany, Maria, Greene, Derek"))

That means the *P\&P* characters are unusually **interconnected**.

And Elizabeth is the perfect narrative hub. The social world keeps passing through her: almost every important social cluster eventually intersects with her.

*Emma* is interesting here too. It has **193 characters**, 620 connections and 5% density — much more populous than *P\&P*, but its social world is strongly organized around **Highbury** and Emma's interpretations of it. ([Derek Greene](https://derekgreene.com/papers/grayson16websci.pdf?utm_source=chatgpt.com "<table id=\"e1\">"))

So I'd roughly characterize the six like this:

**Pride and Prejudice — the party network**\
Many medium-to-large groups, rapidly recombined.

**Emma — the village network**\
Lots of people, but a relatively stable social ecosystem observed through Emma.

**Mansfield Park — the household network**\
Huge cast, but many people are peripheral; the central group spends a lot of time together.

**Sense and Sensibility — the travelling/socially displaced network**\
Large cast, but the Dashwoods repeatedly move between social environments.

**Northanger Abbey — the small-group social comedy**\
Fewer characters and a particularly strong Bath/Abbey split.

**Persuasion — the intimate network**\
Quite a respectable character count, but the novel repeatedly narrows its attention to small groups and private emotional encounters.

One caveat: Austen's six novels are not actually divided into "scenes" in the theatrical sense, so I **wouldn't present the average-character-per-scene numbers above as hard statistics**. The hard data support the underlying phenomenon, though: *P\&P* has the **highest social-network density**, despite having fewer characters than every Austen novel except *Northanger Abbey*. ([UCD Research Repository](https://researchrepository.ucd.ie/server/api/core/bitstreams/81eb2b88-2a46-43ff-8e45-3914eca10358/content?utm_source=chatgpt.com "Title Authors(s) | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings Grayson, Siobhán, Mulvany, Maria, Wade, Karen, Meaney, Gerardine, Greene, Derek --- | --- Title Publication date | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings 2016-09-21 Title Publication information | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings Grayson, Siobhán, Maria Mulvany, Karen Wade, Gerardine Meaney, and Derek Greene. “Novel2Vec: Characterising 19th Century Fiction via Word Embeddings,” September 21, 2016. Title Conference details | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings 24th Irish Conference on Artificial Intelligence and Cognitive Science (AICS'16), University College Dublin, Dublin, Ireland, 20-21 September 2016 Title Item record/more information | Novel2Vec: Characterising 19th Century Fiction via Word Embeddings http://hdl.handle.net/10197/8360Downloaded 2026-05-04 01:06:44"))

And I think there's an even better way to test your hypothesis: **count the number of characters physically present in every distinct social episode in all six novels**, then plot the distributions rather than just their averages. My guess is that *P\&P* wouldn't merely have the highest mean — it would have the most pronounced **U-shaped distribution: lots of 2–3-person scenes and lots of 7–15-person scenes, with relatively few scenes in the 4–6 range.** That's probably the statistical version of the "intimate or bustling, rarely in the middle" feeling you're describing.

> 💡This conversation was continued in [[01M1SGK20T894D9ZXX9WTJFQ9G]].

