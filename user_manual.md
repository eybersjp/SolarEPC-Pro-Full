# SolarEPC Pro — Comprehensive User Manual

## 1. Introduction
SolarEPC Pro is an end-to-end operating system for commercial and utility-scale solar EPCs. This guide walk you through the entire project lifecycle, from tender creation to technical design and financial reporting.

---

## 2. Project Lifecycle: From Start to Finish

### Step 1: Authentication & Access
1.  **Login**: Access the platform at the login page.
2.  **Dashboard**: After logging in, you will see the **Dashboard**, which lists recent activity and active tenders.
3.  **Navigation**: Use the sidebar to navigate between **Tenders**, **Equipment Library**, and **Settings**.

### Step 2: Tender Management
*The foundation of any project in SolarEPC Pro.*

1.  **View Tenders**: Click **"Tenders"** in the sidebar to see all existing projects.
2.  **Create a Project**: Click the **"+ New Tender"** button at the top right.
    -   **Form Entry**: Fill in the Project Name, Client Name, and Target Capacity (kW).
    -   **Coordinates**: (Optional) Enter the Latitude and Longitude to enable location-based energy estimates.
3.  **Save**: Click **"Save Changes"** to create the tender. You will be redirected to the **Tender Overview** page.

### Step 3: Go/No-Go Preconditions
*Validation before engineering begins.*

1.  **Open Checklist**: From the Tender Overview, click the **"Preconditions"** module button.
2.  **Assessment**: Review the critical requirements:
    -   Check boxes for **Grid Connection**, **Land Access**, **Permits**, and **Financing**.
    -   **Assessment Notes**: Add any technical or administrative comments in the text area.
3.  **Final Decision**: Toggle the **"Final Project Stand"** switch to **"Go"** when ready.
4.  **Save**: Click **"Save Assessment"**.

### Step 4: PV Design & System Sizing
*Technical configuration of the solar plant.*

1.  **Open PV Design**: From the Tender Overview, click **"PV Design"**.
2.  **Create Design**: Click **"Create First Design"** (or **"+ Add Design"**).
3.  **Select Equipment**:
    -   Choose a **Solar Module** and **Inverter** from the dropdowns.
    -   Set the **Tilt (deg)** and **Azimuth (deg)**.
    -   Select the **Site Type** (Rooftop, Ground Mount, or Carport).
4.  **Save**: Click **"Save"**. The system will calculate the DC:AC ratio and validate the configuration.

### Step 5: The Design Canvas (Spatial Layout)
*Visual panel placement and spatial engineering.*

1.  **Enter Canvas**: In the PV Design list, click the **"Chevron Right"** arrow or click the design row to enter the **Design Canvas**.
2.  **Canvas Tools**:
    -   **Toolbar (Top)**: Monitor the **Sync Status** (Saved/Syncing). Use the **"Save Copy"** button to iterate on layouts.
    -   **Properties Panel (Right)**: Click the **"Settings"** icon or the **"Chevron Left"** button to open the properties panel. This displays technical data for selected items.
    -   **Map Area**: (Simulated) Define boundaries and exclusion zones directly on the map.
3.  **Exit**: Click the **"Back Arrow"** in the top left to return to the design list.

### Step 6: Energy Estimation & Financials
*Economics and Yield.*

1.  **Automatic Calculation**: Once a design is valid and layout is set, the system automatically triggers an NREL PVWatts estimate and calculates the financials.
2.  **View Results**: Navigate to **"BOQ & Pricing"** from the Tender Overview.
3.  **Bill of Quantities (BOQ)**:
    -   Review the **Line Items** table, which includes modules, inverters, and mounting costs.
    -   **Edit Items**: Click the **"Edit"** icon on any row to adjust unit costs or quantities.
    -   **Add Items**: Click **"+ Add Item"** to include custom costs (e.g., labor, grid connection fees).
4.  **Summary**: Check the **BOQ Summary** cards for Total Cost, Total Margin, and Grand Total.

### Step 7: Proposals & Exports
*Handover and Client Reporting.*

1.  **Export Data**: In the BOQ page, click the **"Export"** dropdown button.
    -   **Export as CSV**: Download a spreadsheet-ready Bill of Materials.
    -   **Export as JSON**: Download the raw data for integration with other tools.
2.  **PDF Proposals**: (Currently being expanded) Targeted for delivery via the **"Proposals"** API, generating a full client-ready PDF report.

---

## 3. Best Practices
-   **Always Save**: Look for the **"Saved"** checkmark in the Canvas Toolbar before exiting.
-   **Check Blockers**: If the Preconditions module shows **"Incomplete Prerequisites"**, ensure all critical checkboxes are hit and the Go switch is toggled.
-   **Iterate**: Use **"Save Copy"** in the Canvas to compare different spacing or orientation strategies without losing your original design.
