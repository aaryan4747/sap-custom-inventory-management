<p align="center">
  <img src="repo_banner.png" alt="SAP ABAP Custom Inventory System Banner" width="100%" style="border-radius: 8px;" />
</p>

<h1 align="center">SAP Custom Inventory Management &amp; Stock Replenishment</h1>

<p align="center">
  <a href="https://github.com/aaryan4747/sap-custom-inventory-management">
    <img src="https://img.shields.io/badge/SAP-ABAP_7.50+-008fd3?style=for-the-badge&logo=sap&logoColor=white" alt="SAP ABAP Version" />
  </a>
  <a href="https://github.com/abapGit/abapGit">
    <img src="https://img.shields.io/badge/abapGit-compatible-orange?style=for-the-badge&logo=git&logoColor=white" alt="abapGit Compatible" />
  </a>
  <img src="https://img.shields.io/badge/Fiori-Design_System-0070f3?style=for-the-badge&logo=sap" alt="Fiori Styling" />
  <img src="https://img.shields.io/badge/License-MIT-4caf50?style=for-the-badge" alt="License MIT" />
</p>

<p align="center">
  <strong>An end-to-end, production-ready custom SAP module showcasing modern ABAP design principles.</strong> Incorporates Custom DDIC Transparent Tables, Object-Oriented ABAP, standard Business Add-In (BAdI) updates interception, real-time balance calculations, automated purchase requisition workflows, and an interactive ALV Grid Report.
</p>

---

## 📖 Table of Contents
* [⚙️ System Architecture](#-system-architecture)
* [📂 Repository Structure](#-repository-structure)
* [🛠️ SAP Database Dictionary (DDIC)](#%EF%B8%8F-sap-database-dictionary-ddic)
* [⚡ Object-Oriented ABAP Logic](#-object-oriented-abap-logic)
* [🔌 BAdI Enhancement Automation](#-badi-enhancement-automation)
* [🖥️ ALV Grid Manager Report](#%EF%B8%8F-alv-grid-manager-report)
* [🚀 Interactive Web Simulator](#-interactive-web-simulator)

---

## ⚙️ System Architecture

The following diagram illustrates the transaction update flow and background automation cycle within the SAP NetWeaver AS ABAP environment:

```mermaid
graph TD
    A[MIGO / Goods Movement] -->|Triggers Update Task| B[MB_DOCUMENT_BADI]
    B -->|Calls method before update| C[ZCL_IM_INV_REPL_BADI]
    C -->|Logs history| D[(ZMINVENT_MOVE)]
    C -->|Calculates Stock & Threshold| E[ZCL_INVENTORY_BALANCE]
    E -->|Reads base stock| F[(ZMINVENT_MASTER)]
    E -->|Sums history| D
    E -->|Stock &le; Safety Limit?| G{Trigger Replenishment?}
    G -->|Yes| H[BAPI_PR_CREATE / Workflow Event]
    G -->|No| I[Commit Work]
    
    J[ZINV_ALV_REPORT] -->|Calls check| E
    J -->|Displays table| K[CL_SALV_TABLE ALV Grid]
```

---

## 📂 Repository Structure

The files inside the `src/` directory conform to the standard `abapGit` naming conventions and XML schemas, allowing direct installation into any SAP development client:

```
├── src/
│   ├── zminvent_master.tabl.xml       # DDIC: Material Safety Stocks Table
│   ├── zminvent_move.tabl.xml         # DDIC: Goods Movements Log Table
│   ├── zcl_inventory_balance.clas.abap# OO-ABAP: Balance & Reorder Engine
│   ├── zcl_inventory_balance.clas.xml # Class Metadata (Unicode, Description)
│   ├── zcl_im_inv_repl_badi.clas.abap # BAdI: MB_DOCUMENT_BADI Implementation
│   ├── zcl_im_inv_repl_badi.clas.xml  # BAdI: Implementation Class Metadata
│   ├── zinv_repl_badi.enho.xml        # BAdI: Enhancement Spot Configuration
│   ├── zinv_alv_report.prog.abap      # ALV: Report program utilizing CL_SALV_TABLE
│   └── zinv_alv_report.prog.xml       # ALV: Program Properties & Text Pool
├── abapgit.xml                        # abapGit repository configuration
├── index.html                         # Web Simulator: Core HTML structures
├── style.css                          # Web Simulator: Custom Fiori styling
├── app.js                             # Web Simulator: Logical JS engine
├── repo_banner.png                    # Repository banner image
└── README.md                          # Repository documentation
```

---

## 🛠️ SAP Database Dictionary (DDIC)

We defined custom tables to handle inventory states with strict referential validation:

### 1. Master Table: `ZMINVENT_MASTER`
Contains plant-specific material records and safety-stock thresholds.
* **`MATNR`** (Key): Material number (Type `MATNR`, length 18).
* **`LABST`**: Valuated stock baseline (Type `LABST`, decimal quantity).
* **`MIN_STOCK`**: Minimum safety stock limit. Breach triggers replenishment.
* **`REORDER_QTY`**: Quantity requested during automated procurement.
* **`MEINS`**: Reference unit of measure (Type `MEINS`, reference field for quantities).

### 2. Transaction Delta Table: `ZMINVENT_MOVE`
Logs the goods issues and receipts, ensuring full trace capability.
* **`MBLNR`** (Key): Material document number (Type `MBLNR`, length 10).
* **`MJAHR`** (Key): Document year (Type `MJAHR`, length 4).
* **`ZEILE`** (Key): Document line item (Type `MBLPO`, length 4).
* **`BWART`**: Goods movement type (e.g. 101 GR, 201 GI).
* **`SHKZG`**: Debit/Credit Indicator (`S` = Addition/Receipt, `H` = Subtraction/Issue).

---

## ⚡ Object-Oriented ABAP Logic

The balance calculations are encapsulated inside the class `ZCL_INVENTORY_BALANCE`. This decoupling keeps report logic independent of database updates.

* **`calculate_realtime_balance`**: Selects the baseline stock from `ZMINVENT_MASTER` and dynamically aggregates all movements from `ZMINVENT_MOVE` (adding receipts, subtracting issues) to determine the current inventory balance.
* **`check_safety_threshold`**: Calls the balance method and compares it to `ZMINVENT_MASTER-MIN_STOCK`. Returns an indicator if the stock is critically low.
* **`trigger_replenishment`**: Simulates the standard workflow trigger. In production, this calls `BAPI_PR_CREATE` or fires a Business Workflow event (e.g., triggering BOR Object `BUS2009` Event `CREATED`) to raise a Purchase Requisition.

---

## 🔌 BAdI Enhancement Automation

Automated stock replenishment is handled by enhancing standard SAP goods movements. We implemented the Business Add-In (BAdI) **`MB_DOCUMENT_BADI`** in method **`MB_DOCUMENT_BEFORE_UPDATE`**.

### BAdI Code Flow:
1. Loops through `XMSEG` (internal table containing lines of the material document currently being posted).
2. If the movement type reduces inventory (Debit/Credit indicator `SHKZG = 'H'`), it inserts a log entry into `ZMINVENT_MOVE`.
3. Invokes `ZCL_INVENTORY_BALANCE=>CHECK_SAFETY_THRESHOLD` in the background.
4. If a stock breach is detected, it reads the reorder quantity and triggers `ZCL_INVENTORY_BALANCE=>TRIGGER_REPLENISHMENT` to raise a Purchase Requisition before the standard transaction completes.

---

## 🖥️ ALV Grid Manager Report

The program `ZINV_ALV_REPORT` displays live data to managers.
* Uses the modern object-oriented Grid wrapper **`CL_SALV_TABLE`**.
* Implements cell and row coloring, highlighting materials with stocks below safety limits in **red**.
* Employs custom event handlers to capture **Double-Click** events, launching a secondary pop-up ALV displaying the movement log history for that specific material (drilldown reporting).

---

## 🚀 Interactive Web Simulator

The project includes a web-based, Fiori-themed sandbox to simulate this SAP architecture without requiring an active SAP NetWeaver license.

### Launching the Simulator:
1. Open the project root folder.
2. Double-click the `index.html` file to open it in any modern browser.
3. *Alternative (Node Server)*: Run `npm install && npm start` to launch a development server on `http://localhost:3000`.

### Simulation Playground Features:
* **Fiori Overview Tiles**: View live counts of tracked items, critical alerts, and logged movements.
* **ALV Grid Simulator**: Sort, search, filter, and double-click rows to view secondary logs in detail.
* **MIGO Movement Poster**: Post a Goods Issue (201) to drop stock below threshold. Watch the **BAdI Interception Engine Console** execute the check and trigger a Purchase Requisition step-by-step in real-time.
* **abapGit Control Panel**: Simulate code changes in the source code explorer and stage/commit local changes.
