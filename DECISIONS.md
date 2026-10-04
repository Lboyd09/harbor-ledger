# Decisions

Newest first. If this file conflicts with earlier chat, this file wins.

## 2026-10-04

48. Simple Home is the answer, one picture, and one next action. The rest sits under "More" or in Advanced.
47. A retirement calculator exists: where you stand, what you want, the gap, and what closes it.
46. Every calculator starts from the person's real numbers, says what each came from, and shows its assumptions, which are editable.
45. Setup asks age. Retirement and IRA calculators use it. It can be changed in Account.
44. Every number says what it is based on. A reading that the data cannot support shows what more history would unlock.
43. Simple mode shows the answer, one picture, and one next action. Advanced mode shows every metric the data supports, grouped, each explained in plain words and with how it was worked out.
42. Budget, Month, and Home lead with what matters: what is over or at risk, what is coming, what the file already shows. Money in is on one side and money out is on the other.
41. When the person must choose, they decide once per name, biggest dollars first, with ranked suggestions. The same screen is used everywhere charges are sorted.
40. A charge the app is fairly sure about is sorted for the person, marked "Check", and counted in every total until confirmed or changed. Only charges with no good guess wait.
39. A reading stays quiet until the charges can support it. A month-end forecast uses the date you pass in, not the clock. One month can already say what went out, the largest charge, the busiest day, and the biggest category, and it lists what is still waiting on more history.
38. A bank file's Category column is a label, not something to ignore. When it matches a category, that charge is checked and sorted, and the reason is shown. Memo is extra words for sorting and for the note. It does not replace the description. Vague labels such as Other stay unsorted.
37. A spending category can carry over or start fresh on its own. If that choice is missing, it follows the ledger. Income never carries. Switching a category does not delete its usual amount, a one-month amount, or its charges. The ledger still has one default. This narrows decision 1 and decision 33 only for that override.
36. The app leads with what the charges already show: a typical month, the biggest category, what repeats, and what has no category. The person should not have to type that.
35. Budget is two sides on one screen: money in, and money out. Spending categories such as rent, groceries, insurance, and eating out are the budget.
34. Income is compared with what usually comes in. It does not carry a balance, because pay changes from month to month.
33. Start fresh or carry over applies to spending categories only. A fund is extra savings for one purchase. It is not the budget, and linking a category to a fund does not take that category off the budget.

## 2026-10-03

32. The look gets more visual and animated. Animation obeys the Motion setting and the device's reduced-motion setting.
31. Grow is visual first: pictures that show where money can go and what it becomes, with the numbers underneath.
30. Each budget category has a clear visual in the carry-over style.
29. Home shows every account with the balance from its latest import (or the last balance typed in) and the total.
28. Home is a dashboard with a whole-year overview. The month is a separate page.
27. In the carry-over style the Month page shows what came in from last month, what this month adds, what was spent, and what is left, with a plain sentence about cutting back or extra money.
26. Every category amount can be changed for one month. The usual amount stays visible and can be restored in one tap.
25. On the Month page a category can be changed three ways: for this charge only, for every charge from that name in this month only, or as the default for every month.
24. Each name (merchant) has one default category for money in and one for money out. The Sorting page is where defaults are changed. Changing a default changes every charge from that name, except charges the person set by hand for one charge or for one month.
23. The Month page is its own page. Home becomes a year dashboard later, so nothing about Home changes now.
22. The Account screen lists the accounts and lets the person change the budget style later, as setup promises.
21. After an import, the person sees what was sorted and then reviews the unsure charges one at a time, on the import screen itself.
20. Import sorts a charge on its own only when it is sure. Deposits are matched to the expected income entered in setup. Everything else is left for the person with a suggested category ready to accept.
19. Every file is imported into one chosen account. Each account has its own imports. Retirement and investment accounts have no file; their balance is updated by typing it in.
15. Setup is one path of seven steps: About you, What you pay for, Money coming in, How leftover money works, Your amounts, Accounts and a savings plan, Your plan on one page. There is no bank-file path in setup. Charges are categorized after setup, inside the app. This supersedes 6.
16. Setup collects expected income for every source, including how often it is paid and words from the deposit, so income can be recognized on import without being added later.
17. The person picks the budget style in setup ("Start fresh each month" or "Carry over what's left") and can change it later in Account.
18. Setup can record accounts with today's balance (checking, savings, credit card, Roth IRA or other retirement, investments, other) and one optional savings plan.
1. The app uses one budget style at a time, set for the whole ledger: "Start fresh each month" or "Carry over what's left". It is chosen during setup and can be changed later. Categories are not mixed.
2. In carry-over, whatever is left in a category carries into next month, and so does an overspend. An overspend is a need to cut back. A surplus is extra to spend, with a suggestion to put it to work.
3. A separate optional savings plan exists for saving toward one purchase.
4. Setup collects expected income for each source, so income does not have to be added later.
5. The app supports several accounts (checking, savings, credit card, Roth IRA, other investments). Each account has its own imports, and its balance is the latest import.
6. Superseded by 15. The first screen used to let the person choose between "Start with my income and goals" and "Start with my bank file".
7. Most transactions come in by importing a bank CSV.
8. Opening a fund shows the last 12 months first (what has been saved, or how far over budget), with a Month view one tap away.
9. Making a fund is a short guided wizard, one question per screen.
10. First-time setup is guided, 5 to 7 steps, and each step explains why it is asking.
11. Money that is set aside and keeps what you don't spend is called a Fund. The word "bucket" goes away in everything the person sees.
12. Main navigation is: Home, Budget, Funds, Grow, Account. Funds has its own tab.
13. Only the Nerd analytics tools stay hidden until asked for. Payback matching, splitting a charge, merchant rules, and the year spreadsheet and charts stay visible.
14. For funds, "the year" means the last 12 months, always rolling.