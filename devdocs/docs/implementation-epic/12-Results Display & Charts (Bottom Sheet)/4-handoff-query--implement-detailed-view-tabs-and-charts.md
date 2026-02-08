I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Add tabbed sections with detailed metrics and charts:

- Extend `ResultsBottomSheet` component with tabs using `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\ui\tabs.tsx`
- Create **System Overview** tab: total modules, system size, DC:AC ratio
- Create **Energy Production** tab with monthly bar chart using Recharts (12 months data from `monthly_energy_kwh`)
- Add performance metrics: annual energy, capacity factor, "Powered by PVWatts" attribution
- Create **Financial Metrics** tab: payback period, ROI, annual savings, system cost
- Display assumptions (electricity rate, escalation rate)