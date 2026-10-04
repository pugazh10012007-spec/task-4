# Tickit: To-Do Web App (SkillCraft Technology, Task 04)

A to-do app built with plain HTML, CSS and JavaScript. No backend, no build step, no frameworks.

## What the task asked for, and where it is

| Requirement | How Tickit does it |
| --- | --- |
| Add tasks | Type a name and press **Add task** (Enter works too) |
| Maintain tasks | **Edit** any task inline, or **Delete** it (with an Undo button) |
| Organise items in lists | Create, rename and delete lists in the sidebar; move a task to another list from its Edit form; the **All tasks** view shows everything |
| Mark as completed | Tick the box: the title is struck through, the card turns lime, confetti pops, and the task moves to the bottom |
| Set date and time | Date and time pickers when adding or editing; chips show Today, Tomorrow or Overdue |

## Extra features
- Login, sign-up and guest mode (the app page is protected: logged-out visitors go back to the login page)
- Progress ring that fills as tasks are completed
- Filters (All, Active, Done), search and sorting (due date, priority, newest, A to Z)
- Priority levels (Low, Normal, High)
- Reminders: a message appears when a timed task becomes due, and browser notifications if you press **Get alerts**
- Undo for deleted tasks, deleted lists and cleared completed tasks
- Keyboard: press **N** to jump to the new-task box, **Esc** cancels an edit
- Responsive layout (phone, tablet, desktop), visible keyboard focus, and reduced-motion support

## Animations
Login page headline reveal, a moving belt of tasks that tick themselves, a running ticker strip, tasks that spring in, a stamp effect on the tick box, a strike-through that draws itself, tasks that slide to their new place and slide out when deleted, confetti, an animated progress ring and toast messages.

## Files
| File | Purpose |
| --- | --- |
| `index.html`, `auth.js` | Login and sign-up page |
| `app.html`, `script.js` | The to-do app |
| `style.css` | Shared theme |

## Run it
Open `index.html` in a browser, or publish it with GitHub Pages (Settings > Pages > Deploy from a branch > `main` / root).

## Notes
- Fonts (Unbounded and Plus Jakarta Sans, both open source) load from Google Fonts, so an internet connection is needed to see them. Without it, the app falls back to system fonts.
- Accounts and tasks are saved in the browser's storage on your own device. This is a frontend project, not production authentication.
