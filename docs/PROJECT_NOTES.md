# FraudLens - the project in plain words

## The big idea
Banks have millions of card transactions and a few are fraud. We teach a computer
from old transactions already marked "normal" or "fraud". Then it looks at a new
one and says how suspicious it looks.

## The 5 parts
1. **The data.** 284,807 real card transactions: time, amount, 28 scrambled columns (V1-V28), and a label (0 normal, 1 fraud). The columns are scrambled to protect privacy.
2. **The problem.** Only 492 are fraud (about 0.17%). A lazy model saying "everything is normal" is right 99.8% of the time and catches zero fraud, so we do not judge by accuracy.
3. **Training.** 80% of rows to learn from, 20% held back as a test set it has never seen. Fraud counts for extra.
4. **Comparing 3 models.** Logistic Regression (many false alarms), Gradient Boosting (in the middle), Random Forest (the winner: 100 small decision-makers voting).
5. **The app.** The saved forest wrapped in a web page: pick a transaction, get a fraud percentage and a green or red verdict.

## Saying the scores
- **Precision**: when the model says "fraud", how often is it right? High = few false alarms.
- **Recall**: of all real frauds, how many did it catch? High = few frauds missed.

## Beyond the basic app (FraudLens extras)
"Why this score" breakdown, what-if sandbox, Live Monitor, threshold lab,
cost simulator (finds the cheapest threshold), model runs in the browser.

Remember to run the real data through `ml/` so the numbers in the app are real (see README).
