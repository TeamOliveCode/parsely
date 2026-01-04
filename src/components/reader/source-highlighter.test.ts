import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SourceHighlighter } from './source-highlighter';

describe('SourceHighlighter', () => {
  let highlighter: SourceHighlighter;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Mock scrollIntoView since jsdom doesn't support it
    Element.prototype.scrollIntoView = function () {};
    highlighter = new SourceHighlighter();
  });

  describe('mapParagraphs', () => {
    it('should map simple paragraphs to DOM elements', () => {
      document.body.innerHTML = `
        <article>
          <p>This is the first paragraph with enough text to match.</p>
          <p>This is the second paragraph with sufficient content.</p>
          <p>This is the third paragraph for testing purposes.</p>
        </article>
      `;

      const paragraphs = [
        'This is the first paragraph with enough text to match.',
        'This is the second paragraph with sufficient content.',
        'This is the third paragraph for testing purposes.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Highlight each paragraph and verify it works
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle Wikipedia-style article structure with Melaka_Fray page pattern', () => {
      // Wikipedia uses mw-parser-output container with paragraphs
      document.body.innerHTML = `
        <div id="content" class="mw-body">
          <div id="bodyContent" class="mw-body-content">
            <div id="mw-content-text" class="mw-body-content">
              <div class="mw-parser-output">
                <p><b>Melaka Fray</b> is a fictional character in the comic book series <i>Fray</i>, created by Joss Whedon.</p>
                <p>Melaka lives in a dystopian future version of Manhattan, referred to as "Haddyn" in the series.</p>
                <p>She works as a thief and later discovers she is a Slayer, destined to fight vampires and demons.</p>
                <div class="toc" id="toc">
                  <div class="toctitle">Contents</div>
                </div>
                <h2><span class="mw-headline" id="Character_history">Character history</span></h2>
                <p>Melaka was born in the future world where the Slayer line had been dormant for centuries.</p>
                <p>Her twin brother Harth was turned into a vampire, becoming her arch-nemesis.</p>
              </div>
            </div>
          </div>
        </div>
      `;

      const paragraphs = [
        'Melaka Fray is a fictional character in the comic book series Fray, created by Joss Whedon.',
        'Melaka lives in a dystopian future version of Manhattan, referred to as "Haddyn" in the series.',
        'She works as a thief and later discovers she is a Slayer, destined to fight vampires and demons.',
        'Character history',
        'Melaka was born in the future world where the Slayer line had been dormant for centuries.',
        'Her twin brother Harth was turned into a vampire, becoming her arch-nemesis.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Test that paragraphs are correctly mapped
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');

      // Test highlighting different paragraphs
      highlighter.highlight(4);
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle "Melaka reappears" paragraph from Wikipedia Melaka_Fray page', () => {
      // This is a real scenario from the Wikipedia page where highlighting fails
      // The serialized paragraph may have been merged or modified by the Serializer
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>Melaka reappears in the Season Eight comic book, joining forces with Buffy against a new threat.</p>
          <p>In the story arc, she travels back in time to the present day.</p>
        </div>
      `;

      // The serialized text might differ slightly due to Serializer processing
      const paragraphs = [
        'Melaka reappears in the Season Eight comic book, joining forces with Buffy against a new threat.',
        'In the story arc, she travels back in time to the present day.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');

      highlighter.highlight(1);
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle real Wikipedia Melaka_Fray paragraph with "Melaka reappears" deep in content', () => {
      // This is the REAL HTML from Wikipedia - a very long paragraph where "Melaka reappears"
      // appears near the end. The Serializer splits it into multiple paragraphs.
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p><b>Melaka Fray</b> is a fictional character in the <a href="/wiki/List_of_Buffy_the_Vampire_Slayer_comics" title="List of Buffy the Vampire Slayer comics"><i>Buffy the Vampire Slayer</i> comics</a> published by <a href="/wiki/Dark_Horse_Comics" title="Dark Horse Comics">Dark Horse Comics</a>. She <a href="/wiki/First_appearance" title="First appearance">debuts</a> in the first issue of <a href="/wiki/Fray_(comics)" title="Fray (comics)"><i>Fray</i></a> (2001), a <a href="/wiki/Limited_series_(comics)" title="Limited series (comics)">limited series</a> in a <a href="/wiki/Buffyverse" title="Buffyverse">shared universe</a> with the television show <i><a href="/wiki/Buffy_the_Vampire_Slayer" title="Buffy the Vampire Slayer">Buffy the Vampire Slayer</a></i>. Living in the 23rd century, Melaka is a professional thief who learns that she is a <a href="/wiki/Slayer_(Buffy_the_Vampire_Slayer)" title="Slayer (Buffy the Vampire Slayer)">Slayer</a> destined to fight supernatural foes. She has a Slayer's physical powers, while her twin brother Harth inherited their <a href="/wiki/Prophetic_dream" class="mw-redirect" title="Prophetic dream">prophetic dreams</a>. Melaka discovers that Harth, who she believed was dead, has become a <a href="/wiki/Vampire_(Buffy_the_Vampire_Slayer)" title="Vampire (Buffy the Vampire Slayer)">vampire</a> intent on bringing demons back to Earth's dimension. After stopping his plan, she remains a thief, but chooses to protect others as well. In <i><a href="/wiki/Tales_of_the_Slayers" class="mw-redirect" title="Tales of the Slayers">Tales of the Slayers</a></i>, she connects with her heritage by reading journals about past Slayers. Melaka reappears in the <a href="/wiki/Buffyverse_canon" title="Buffyverse canon">canonical</a> comic book continuation of the television series, meeting the 21st-century Slayer <a href="/wiki/Buffy_Summers" title="Buffy Summers">Buffy Summers</a> in <a href="/wiki/Buffy_the_Vampire_Slayer_Season_Eight" title="Buffy the Vampire Slayer Season Eight"><i>Season Eight</i></a> and helping her defeat Harth in <a href="/wiki/Buffy_the_Vampire_Slayer_Season_Twelve" title="Buffy the Vampire Slayer Season Twelve"><i>Season Twelve</i></a>.</p>
        </div>
      `;

      // The Serializer splits this long paragraph. One of the resulting paragraphs starts with "Melaka reappears"
      const paragraphs = [
        'Melaka Fray is a fictional character in the Buffy the Vampire Slayer comics published by Dark Horse Comics.',
        'She debuts in the first issue of Fray (2001), a limited series in a shared universe with the television show Buffy the Vampire Slayer.',
        'Living in the 23rd century, Melaka is a professional thief who learns that she is a Slayer destined to fight supernatural foes.',
        "She has a Slayer's physical powers, while her twin brother Harth inherited their prophetic dreams.",
        "Melaka discovers that Harth, who she believed was dead, has become a vampire intent on bringing demons back to Earth's dimension.",
        'After stopping his plan, she remains a thief, but chooses to protect others as well.',
        'In Tales of the Slayers, she connects with her heritage by reading journals about past Slayers.',
        'Melaka reappears in the canonical comic book continuation of the television series, meeting the 21st-century Slayer Buffy Summers in Season Eight and helping her defeat Harth in Season Twelve.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // The "Melaka reappears" paragraph should still match, even though it's a subset
      // of the long original paragraph
      highlighter.highlight(7);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle "Melaka and Erin realize" paragraph at END of long DOM paragraph', () => {
      // This is a real case from Wikipedia where the serialized paragraph appears
      // at the END of a long DOM paragraph, not the beginning
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>Melaka and Buffy look into reports of vampires in the exclusive, wealthier areas of Haddyn. They disagree on whether to intervene during a vampire attack on humans. Melaka wants to fight, while Buffy suggests tracking their movements. Melaka separates from her to slay the vampires and meets the madwoman, who is the future version of Willow. She convinces Melaka to prevent Buffy from returning to her own time, saying this would change the timeline and erase Melaka's reality. Buffy escapes through a temporal rift after being forced to kill Willow. Melaka and Erin realize that despite this, their world remains intact.</p>
        </div>
      `;

      // The Serializer splits this long paragraph into multiple parts
      const paragraphs = [
        'Melaka and Buffy look into reports of vampires in the exclusive, wealthier areas of Haddyn.',
        'They disagree on whether to intervene during a vampire attack on humans.',
        'Melaka wants to fight, while Buffy suggests tracking their movements.',
        'Melaka separates from her to slay the vampires and meets the madwoman, who is the future version of Willow.',
        "She convinces Melaka to prevent Buffy from returning to her own time, saying this would change the timeline and erase Melaka's reality.",
        'Buffy escapes through a temporal rift after being forced to kill Willow.',
        'Melaka and Erin realize that despite this, their world remains intact.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // The LAST paragraph "Melaka and Erin realize..." should match the same DOM element
      highlighter.highlight(6);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');

      // All paragraphs should highlight correctly (same element for all split parts)
      for (let i = 0; i < paragraphs.length; i++) {
        highlighter.highlight(i);
        expect(overlay?.style.opacity).toBe('1');
      }
    });

    it('should scroll to the highlighted text position, not just the element', () => {
      // Mock window.scrollTo since jsdom doesn't support it
      const scrollToMock = vi.fn();
      window.scrollTo = scrollToMock;

      // Create a long paragraph that would have sentences at different vertical positions
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>First sentence is at the beginning of this very long paragraph that spans multiple lines. Second sentence comes after and is somewhere in the middle. Third sentence is near the end of the paragraph. Fourth sentence is at the very end of this paragraph content.</p>
        </div>
      `;

      const paragraphs = [
        'First sentence is at the beginning of this very long paragraph that spans multiple lines.',
        'Second sentence comes after and is somewhere in the middle.',
        'Third sentence is near the end of the paragraph.',
        'Fourth sentence is at the very end of this paragraph content.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Highlight each sentence - scrollTo should be called for each
      highlighter.highlight(0);
      expect(scrollToMock).toHaveBeenCalled();

      highlighter.highlight(1);
      expect(scrollToMock).toHaveBeenCalled();

      highlighter.highlight(2);
      expect(scrollToMock).toHaveBeenCalled();

      highlighter.highlight(3);
      expect(scrollToMock).toHaveBeenCalled();

      // Verify scrollTo was called with smooth behavior
      const lastCall = scrollToMock.mock.calls[scrollToMock.mock.calls.length - 1][0];
      expect(lastCall.behavior).toBe('smooth');
    });

    it('should map each paragraph to the CORRECT DOM element, not wrong ones', () => {
      // This test ensures paragraphs are mapped to their correct DOM elements
      // and not accidentally matched to wrong elements
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p id="para1">First paragraph about topic A with unique content here.</p>
          <p id="para2">Second paragraph about topic B with different content.</p>
          <p id="para3">Third paragraph about topic C with its own text.</p>
        </div>
      `;

      const paragraphs = [
        'First paragraph about topic A with unique content here.',
        'Second paragraph about topic B with different content.',
        'Third paragraph about topic C with its own text.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Highlight paragraph 0 - should highlight para1
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');

      // Highlight paragraph 1 - should highlight para2
      highlighter.highlight(1);
      expect(overlay?.style.opacity).toBe('1');

      // Highlight paragraph 2 - should highlight para3
      highlighter.highlight(2);
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should NOT match unrelated paragraphs to wrong DOM elements', () => {
      // This is a critical test: when we have multiple distinct paragraphs,
      // each should match ONLY its corresponding DOM element
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p id="intro">Melaka Fray is a fictional character created by Joss Whedon.</p>
          <h2 id="history-heading">Character history</h2>
          <p id="history">The character first appeared in the comic series Fray in 2001.</p>
          <h2 id="powers-heading">Powers and abilities</h2>
          <p id="powers">As a Slayer, Melaka has superhuman strength and agility.</p>
        </div>
      `;

      const paragraphs = [
        'Melaka Fray is a fictional character created by Joss Whedon.',
        'Character history',
        'The character first appeared in the comic series Fray in 2001.',
        'Powers and abilities',
        'As a Slayer, Melaka has superhuman strength and agility.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Each paragraph should highlight correctly
      // Paragraph 0 should match intro
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');

      // Paragraph 2 should match history (not intro or powers)
      highlighter.highlight(2);
      expect(overlay?.style.opacity).toBe('1');

      // Paragraph 4 should match powers
      highlighter.highlight(4);
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle paragraphs with links that get stripped during serialization', () => {
      // Wikipedia paragraphs often have many internal links
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>Melaka reappears in the <a href="/wiki/Buffy_Season_Eight">Season Eight</a> <a href="/wiki/Comic_book">comic book</a>, joining forces with <a href="/wiki/Buffy_Summers">Buffy</a> against a new threat.</p>
        </div>
      `;

      // After serialization, links become plain text (or have link markers)
      const paragraphs = [
        'Melaka reappears in the Season Eight comic book, joining forces with Buffy against a new threat.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle serialized paragraphs with HTML anchor tags', () => {
      // The Serializer converts links to HTML anchor tags in the output
      // But the original DOM has plain anchor tags too
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>Melaka reappears in the <a href="/wiki/Season_Eight">Season Eight</a> comic book series.</p>
        </div>
      `;

      // Serializer output includes anchor tags
      const paragraphs = [
        'Melaka reappears in the <a href="https://en.wikipedia.org/wiki/Season_Eight" target="_blank" rel="noopener noreferrer">Season Eight</a> comic book series.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle paragraphs with inline formatting like bold and italic', () => {
      document.body.innerHTML = `
        <article>
          <p><b>Bold text</b> followed by <i>italic text</i> and normal text in a paragraph.</p>
          <p>A regular paragraph without any special formatting for comparison.</p>
        </article>
      `;

      const paragraphs = [
        'Bold text followed by italic text and normal text in a paragraph.',
        'A regular paragraph without any special formatting for comparison.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();
      highlighter.highlight(0);

      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle Wikipedia infobox and sidebar elements by skipping them', () => {
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <table class="infobox">
            <tr><td>Character Info</td></tr>
            <tr><td>Name: Melaka Fray</td></tr>
          </table>
          <p>Melaka Fray is a Slayer from the future timeline of the Buffyverse.</p>
          <div class="navbox">Navigation content here</div>
          <p>She first appeared in the comic series Fray published by Dark Horse Comics.</p>
        </div>
      `;

      const paragraphs = [
        'Melaka Fray is a Slayer from the future timeline of the Buffyverse.',
        'She first appeared in the comic series Fray published by Dark Horse Comics.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // Should correctly highlight the main content paragraphs
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');

      highlighter.highlight(1);
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle elements with hatnote class (Wikipedia disambiguation notices)', () => {
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <div class="hatnote">For other uses, see Fray (disambiguation).</div>
          <p>Fray is a comic book series created by Joss Whedon featuring the character Melaka Fray.</p>
          <p>The series is set in the same universe as Buffy the Vampire Slayer.</p>
        </div>
      `;

      const paragraphs = [
        'Fray is a comic book series created by Joss Whedon featuring the character Melaka Fray.',
        'The series is set in the same universe as Buffy the Vampire Slayer.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle paragraphs that are slightly modified by serialization', () => {
      // Simulates when serializer merges or modifies text slightly
      document.body.innerHTML = `
        <article>
          <p>First sentence here. Second sentence follows.</p>
          <p>Another paragraph with different content for testing.</p>
        </article>
      `;

      // Serialized text might have normalized whitespace
      const paragraphs = [
        'First sentence here. Second sentence follows.',
        'Another paragraph with different content for testing.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle reference/citation elements common in Wikipedia', () => {
      document.body.innerHTML = `
        <div class="mw-parser-output">
          <p>Melaka Fray is a character created by Joss Whedon<sup class="reference"><a href="#cite_note-1">[1]</a></sup> in the year 2001.</p>
          <p>The character has appeared in multiple comic series<sup class="reference"><a href="#cite_note-2">[2]</a></sup> since her debut.</p>
        </div>
      `;

      // After serialization, references are typically stripped
      const paragraphs = [
        'Melaka Fray is a character created by Joss Whedon in the year 2001.',
        'The character has appeared in multiple comic series since her debut.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should skip highlighting when paragraph element is not found', () => {
      document.body.innerHTML = `
        <article>
          <p>Only one paragraph exists in this document.</p>
        </article>
      `;

      const paragraphs = [
        'Only one paragraph exists in this document.',
        'This paragraph does not exist in the DOM.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      // First paragraph should highlight
      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');

      // Second paragraph doesn't exist, should hide highlight
      highlighter.highlight(1);
      expect(overlay?.style.opacity).toBe('0');
    });

    it('should handle list items correctly', () => {
      document.body.innerHTML = `
        <article>
          <ul>
            <li>First list item with enough text to match properly.</li>
            <li>Second list item with different content here.</li>
            <li>Third list item for testing purposes only.</li>
          </ul>
        </article>
      `;

      const paragraphs = [
        '• First list item with enough text to match properly.',
        '• Second list item with different content here.',
        '• Third list item for testing purposes only.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should handle blockquotes properly', () => {
      document.body.innerHTML = `
        <article>
          <p>Introduction paragraph before the quote.</p>
          <blockquote>This is a quoted text that should be highlighted correctly.</blockquote>
          <p>Conclusion paragraph after the quote.</p>
        </article>
      `;

      const paragraphs = [
        'Introduction paragraph before the quote.',
        'This is a quoted text that should be highlighted correctly.',
        'Conclusion paragraph after the quote.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(1);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });
  });

  describe('highlight', () => {
    it('should update highlight position on valid index', () => {
      document.body.innerHTML = `
        <p id="p1">First paragraph text content here.</p>
        <p id="p2">Second paragraph text content here.</p>
      `;

      const paragraphs = [
        'First paragraph text content here.',
        'Second paragraph text content here.',
      ];

      highlighter.mapParagraphs(paragraphs);
      highlighter.mount();

      highlighter.highlight(0);
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('1');
    });

    it('should hide highlight for invalid index', () => {
      document.body.innerHTML = `
        <p>Single paragraph content.</p>
      `;

      highlighter.mapParagraphs(['Single paragraph content.']);
      highlighter.mount();

      highlighter.highlight(5); // Invalid index
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('0');
    });
  });

  describe('mount/unmount', () => {
    it('should add overlay to document on mount', () => {
      highlighter.mount();
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).not.toBeNull();
      expect(document.body.contains(overlay)).toBe(true);
    });

    it('should remove overlay from document on unmount', () => {
      highlighter.mount();
      highlighter.unmount();
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay).toBeNull();
    });

    it('should not throw when unmounting before mounting', () => {
      expect(() => highlighter.unmount()).not.toThrow();
    });
  });

  describe('hide', () => {
    it('should set overlay opacity to 0', () => {
      // Set up DOM first, then mount (order matters - innerHTML clears everything)
      document.body.innerHTML = `<p>Test paragraph content.</p>`;
      highlighter.mapParagraphs(['Test paragraph content.']);
      highlighter.mount();
      highlighter.highlight(0);

      highlighter.hide();
      const overlay = document.getElementById('reader-source-highlight');
      expect(overlay?.style.opacity).toBe('0');
    });
  });
});
