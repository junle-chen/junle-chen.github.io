---
layout: page
title: Paper Radar
subtitle: Agent-planning paper tracking with Zotero links, notes, and code.
full-width: true
---

{% assign papers = site.data.papers.items | sort: "date" | reverse %}
{% assign topics = site.data.papers.topics %}

<section class="paper-page">
  <div class="paper-hero">
    <div>
      <p class="eyebrow">Updated {{ site.data.papers.updated_at | default: "manually" }}</p>
      <h2>Tracked Research Feed</h2>
      <p>Curated records from local notes, Zotero exports, Codex runs, and daily arXiv scans. Archived topics are not shown here.</p>
    </div>
    <div class="paper-topic-strip" aria-label="Tracked topics">
      {% if topics %}
        {% for topic in topics %}
        <span>{{ topic }}</span>
        {% endfor %}
      {% endif %}
    </div>
  </div>

  <div class="paper-controls">
    <label class="paper-search">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
      <input id="paperSearch" type="search" placeholder="Search titles, summaries, tags, topics" autocomplete="off">
    </label>
    <label class="paper-select">
      <span>Topic</span>
      <select id="paperTopicFilter">
        <option value="all">All topics</option>
        {% if topics %}
          {% for topic in topics %}
          <option value="{{ topic | downcase | escape }}">{{ topic }}</option>
          {% endfor %}
        {% endif %}
      </select>
    </label>
  </div>

  <div class="paper-grid" id="paperGrid">
    {% for paper in papers %}
    {% assign author_line = paper.authors | join: ", " %}
    {% assign tag_line = paper.tags | join: " " %}
    <article class="paper-card"
      data-paper-card
      data-title="{{ paper.title | downcase | escape }}"
      data-topic="{{ paper.topic | downcase | escape }}"
      data-tags="{{ tag_line | downcase | escape }}"
      data-summary="{{ paper.summary | downcase | escape }}">
      <div class="paper-card-topline">
        <span>{{ paper.date | default: paper.published | default: "No date" }}</span>
        <span>{{ paper.source | default: "paper" }}</span>
      </div>
      <h3>
        {% if paper.url and paper.url != "" %}
        <a href="{{ paper.url }}" target="_blank" rel="noopener">{{ paper.title }}</a>
        {% elsif paper.pdf_url and paper.pdf_url != "" %}
        <a href="{{ paper.pdf_url }}" target="_blank" rel="noopener">{{ paper.title }}</a>
        {% else %}
        {{ paper.title }}
        {% endif %}
      </h3>
      {% if author_line and author_line != "" %}
      <p class="paper-authors">{{ author_line | truncate: 160 }}</p>
      {% endif %}
      {% if paper.summary %}
      <p class="paper-summary">{{ paper.summary }}</p>
      {% endif %}
      <div class="paper-tags">
        {% if paper.topic %}<span>{{ paper.topic }}</span>{% endif %}
        {% if paper.status %}<span>{{ paper.status }}</span>{% endif %}
        {% for tag in paper.tags limit: 4 %}
        <span>{{ tag }}</span>
        {% endfor %}
      </div>
      <div class="paper-links" aria-label="Paper links">
        {% if paper.pdf_url and paper.pdf_url != "" %}
        <a href="{{ paper.pdf_url }}" target="_blank" rel="noopener"><i class="fa-regular fa-file-pdf" aria-hidden="true"></i> PDF</a>
        {% endif %}
        {% if paper.code_url and paper.code_url != "" %}
        <a href="{{ paper.code_url }}" target="_blank" rel="noopener"><i class="fa-solid fa-code" aria-hidden="true"></i> Code</a>
        {% endif %}
        {% if paper.note_url and paper.note_url != "" %}
        <a href="{{ paper.note_url | relative_url }}"><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> Note</a>
        {% endif %}
        {% if paper.zotero_url and paper.zotero_url != "" %}
        <a href="{{ paper.zotero_url }}"><i class="fa-solid fa-quote-right" aria-hidden="true"></i> Zotero</a>
        {% endif %}
      </div>
    </article>
    {% endfor %}
  </div>

  <div class="empty-filter-state" id="paperEmptyState" hidden>No matching papers.</div>
</section>
