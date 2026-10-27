### ron, R4b: Vars, Memory and the user keys from Find, branch `p1/ron-m4-vars`
**Lane:** day. **Starts when:** R4a, R15c3 and R49 are merged. Backlog step 8, the rest.
**Read:** R4a's report (`git log` of its merge); docs/04 3.4 and 5.1; decisions.md "R15c" point 5 (18 slots, all empty) and "R15b"; `app/src/keyboard/userKeys.svelte.ts` (with R15c3's Alpha layer); `app/src/keyboard/userKeys.test.ts`; `app/src/state/storage.ts` (the `userKeys` key); `app/src/engine/defs.ts` (`userNamesOf`); `app/src/calc/port.ts` (`names()`); `app/src/views/modeSheet.ts` (R49's sections); `docs/mockups/settings.html` section 3, frame "Your keys"; `app/src/find/rank.ts`.
1. **Tests first:** the e2e per path of Done when, by keys and by touch (Vars lists and inserts a stored name; Memory deletes one and clears all; a user key set from Find fires after a reload; a slot holding a place opens it); each fails on phase-1.
2. **Vars** = Find on the user's variables and functions: the live items from `defined` (§3.4), with R4a's keys, preview and insertion.
3. **Shift + Math = Memory:** the same list with delete and clear all (§5.1).
4. **User keys:** Settings › Your keys (a level of R49's sheet, fourth in docs/05 3.4's order; pressing U1–U6 while it is open goes to that key's slots, since the top cluster stays above the sheet) sets U1–U6 and their Shift and Alpha layers (18 slots) from Find, in R15b's stamped store. Besides Find's functions, units and constants, a slot can hold a place or a sheet: Home, CAS, Apps, Menu, Mode, Settings. Reset empties a slot, since every slot ships empty after R15c2.
**Done when:**
- e2e per path by keys and by touch: Vars lists a stored name and inserts it; Memory deletes one and clears all; a user key set from Find fires after a reload; a slot holding a place opens it.
- Task 5 unchanged; the size test passes; the start chunk delta in the report.
