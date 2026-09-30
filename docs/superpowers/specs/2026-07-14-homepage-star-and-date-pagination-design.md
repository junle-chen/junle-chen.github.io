# Homepage Star Button And Daily Paper Date Pagination

## Goal

Make the homepage repository easier to star and keep the Daily Paper date selector compact without changing the paper data or the article-list behavior.

## Homepage Star Button

- Add one compact button below the existing Email and Github buttons on the About landing view.
- Label it `Star this template`.
- Link it to `https://github.com/junle-chen/ac-homepage` and open it in a new tab with `noopener noreferrer`.
- Use an inline SVG star in the style of GitHub's Octicon star, filled with a GitHub-like yellow (`#e3b341`).
- Keep the button visually secondary: smaller than the existing Email and Github buttons, with a light border and the current handwritten typography.
- Do not fetch or display the repository's live star count.

## Daily Paper Date Pagination

- Keep the `All dates` row permanently visible at the top of the date selector.
- Show at most five concrete dates below it, sorted in the existing newest-first order.
- Add a pagination row below the visible dates with a previous arrow, a dynamic `current page / total pages` label, and a next arrow.
- Compute total pages as `Math.ceil(dateCount / 5)`; never hard-code the page count.
- Disable the previous arrow on the first page and the next arrow on the last page.
- Hide the pagination row when there are five or fewer dates.
- Changing the date page must only change which date buttons are visible. It must not change the selected date, selected category, paper ordering, or the rendered article list.
- Clicking a concrete date or `All dates` must retain the existing filtering behavior.
- When a selected date exists, date-list rerenders must keep that date's page visible.
- If the number of dates shrinks, clamp the current page to the new valid range.

## Accessibility And Responsive Behavior

- Pagination controls are real buttons with descriptive English `aria-label` values.
- Disabled arrows use the native `disabled` attribute.
- The pagination row stays centered and fits on narrow screens without horizontal scrolling.

## Verification

- Add unit coverage for five-item slicing, dynamic page counts, first/last-page clamping, and locating the page containing a selected date.
- Verify the date-page controls do not invoke the existing article-filter path.
- Build the project and visually inspect the About landing view and Daily Paper view at desktop and narrow widths.
- Preserve the pre-existing modified `src/assets/content/data/daily-papers.json`, `.playwright-cli/`, and `output/` workspace state.
