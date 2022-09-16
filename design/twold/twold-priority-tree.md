# TWOLD Priority Tree

## Overview

* The purpose of this diagram is to visualize how the story can start from a focal point of the marriage between James and Adelle, and from there branch out into all the other interesting things I want to write about
* These designs play on James being the introvert and Adelle being the extravert
  * In other words: James has a hard time relating to the world outside of his work, while Adelle has a more diverse set of relationships
* With reversed personalities the social aspects of these diagrams would be flipped, though James and Adelle's selected personalities match the average marriage dynamics a little better because women tend to be superior in communal socialization
* Note that these graphs are only highlighting predominant relationships—many more fainter connections could be made between the nodes in these graphs
* There is no special significance whether a node has multiple instances with the same name or not—nodes are split and shared in order to create a clean Mermaid graph (Mermaid's layout system is not nearly as intelligent as other systems such as GraphViz)
* The scope of these diagrams do not extend beyond the couple having infantile children—older children would require more complex children-related graphs, particularly children --> idolatry (children facing their own idolatry)

## Relation to Characters

```mermaid
flowchart TD

%% Layer 1

root([James and Adelle])

%% Layer 2

james([James])
adelle([Adelle])
both([Both])

root --- james
root --- both
root --- adelle

%% Layer 3

subgraph James [Responsibilities]
job([Job])
end

subgraph Both [Responsibilities]
support([Spouse\nSupport])
church([Church])
family([Family])
end

subgraph Adelle [Responsibilities]
shopping([Shopping])
social([Social])
sideJobs([Side Jobs])
end

james --- job

both --- support
both --- church
both --- family

adelle --- shopping
adelle --- social
adelle --- sideJobs

%% Layer 4

subgraph jamesC [Characters]
clients1([Clients\nand\nCoworkers])
antagonists1([Antagonists])
end

subgraph bothC [Characters]
antagonists2([Antagonists])
children([Children])
relatives([Relatives])
friends2([Friends])
end

subgraph adelleC [Characters]
neighbors([Neighbors])
antagonists3([Antagonists])
clients2([Clients])
end

job --- clients1
social --- friends2
social --- neighbors

church --- friends2

job --- antagonists1

sideJobs --- clients2
church --- antagonists2
shopping --- antagonists3
family --- children
family --- relatives
family --- antagonists2
support --- antagonists2
```

## Relation to Themes

```mermaid
flowchart TD

%% Layer 1

root([James and Adelle])

%% Layer 2

james([James])
adelle([Adelle])
both([Both])

root --- james
root --- both
root --- adelle

%% Layer 3

subgraph James [Responsibilities]
job([Job])
end

subgraph Both [Responsibilities]
support([Spouse\nSupport])
church([Church])
family([Family])
end

subgraph Adelle [Responsibilities]
homemaking([Homemaking])
shopping([Shopping])
end

james --- job

both --- support
both --- church
both --- family

adelle --- homemaking
adelle --- shopping

%% Layer 4

subgraph themes1 [Themes]
adventure1([Adventure])
idolatry1([Idolatry])
end

subgraph themes2 [Themes]
adventure2([Adventure])
survival2([Survival])
cozy2([Cozy])
idolatry2([Idolatry])
end

subgraph themes3 [Themes]
survival3([Survival])
cozy3([Cozy])
idolatry3([Idolatry])
end

job --- adventure1
job --- idolatry1

support --- idolatry2
church --- adventure2
church --- cozy2
family --- survival2

homemaking --- cozy3
homemaking --- idolatry3
shopping --- survival3

```

## James Job Relationships

```mermaid
flowchart TD

%% Layer 1

root([James Jobs])

%% Layer 2

root --- cleanup([Cleanup])
root --- design([Design])
root --- expedition([Expedition])

%% Layer 3

cleanup --- boss1([Boss 1])
design --- bear([Bear])
design --- grihulone([Grihulone])
expedition --- boss3([Boss 3])

```

