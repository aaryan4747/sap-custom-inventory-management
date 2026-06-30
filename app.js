/* ==========================================================================
   JavaScript: SAP Custom Inventory Management & Replenishment Simulator
   Author: Antigravity AI Pair Programmer
   ========================================================================== */

// --- INITIAL STATE / MOCK DATA ---
const INITIAL_MASTER = [
    { matnr: 'Z-100', maktx: 'Steel Support Bracket', werks: '1000', lgort: '0001', labst: 120, min_stock: 40, reorder_qty: 100, meins: 'PCS', pr: '' },
    { matnr: 'Z-200', maktx: 'Pneumatic Actuator', werks: '1000', lgort: '0001', labst: 45, min_stock: 30, reorder_qty: 50, meins: 'PCS', pr: '' },
    { matnr: 'Z-300', maktx: 'Industrial Sensor Cable', werks: '1000', lgort: '0001', labst: 500, min_stock: 100, reorder_qty: 400, meins: 'M', pr: '' },
    { matnr: 'Z-400', maktx: 'Hydraulic Pump Seal', werks: '1000', lgort: '0001', labst: 85, min_stock: 20, reorder_qty: 30, meins: 'PCS', pr: '' },
    { matnr: 'Z-500', maktx: 'Micro-Controller Module', werks: '1000', lgort: '0001', labst: 18, min_stock: 15, reorder_qty: 40, meins: 'PCS', pr: '' }
];

const INITIAL_MOVEMENTS = [
    { mblnr: '4900012011', mjahr: '2026', zeile: '0001', matnr: 'Z-100', werks: '1000', lgort: '0001', bwart: '101', shkzg: 'S', menge: 150, meins: 'PCS', cpudt: '2026-06-25', cputm: '10:00:23', usnam: 'SYSTEM' },
    { mblnr: '4900012011', mjahr: '2026', zeile: '0002', matnr: 'Z-100', werks: '1000', lgort: '0001', bwart: '201', shkzg: 'H', menge: 30, meins: 'PCS', cpudt: '2026-06-25', cputm: '10:15:45', usnam: 'MGR_WAREHOUSE' },
    { mblnr: '4900012015', mjahr: '2026', zeile: '0001', matnr: 'Z-200', werks: '1000', lgort: '0001', bwart: '101', shkzg: 'S', menge: 50, meins: 'PCS', cpudt: '2026-06-26', cputm: '09:30:00', usnam: 'SYSTEM' },
    { mblnr: '4900012015', mjahr: '2026', zeile: '0002', matnr: 'Z-200', werks: '1000', lgort: '0001', bwart: '201', shkzg: 'H', menge: 5, meins: 'PCS', cpudt: '2026-06-26', cputm: '11:45:12', usnam: 'DEVELOPER_ABAP' }
];

// Persistent states
let masterData = JSON.parse(localStorage.getItem('sap_master_data')) || [...INITIAL_MASTER];
let movementsData = JSON.parse(localStorage.getItem('sap_movements_data')) || [...INITIAL_MOVEMENTS];
let pendingReplenishmentsCount = parseInt(localStorage.getItem('sap_pending_repl')) || 0;

// DDIC Schema Structure definition for inspector
const DDIC_TABLES = {
    ZMINVENT_MASTER: {
        desc: 'Material Master Safety Stock and Current Inventory',
        delclass: 'A (Application table - master/trans. data)',
        dataclass: 'APPL0 (Master data, transparent)',
        sizecat: '1 (0 to 18,000 records)',
        buffering: 'Not Allowed',
        fields: [
            { name: 'MANDT', key: 'X', rollname: 'MANDT', type: 'CLNT', len: 3, refTab: '', refFld: '', desc: 'Client' },
            { name: 'MATNR', key: 'X', rollname: 'MATNR', type: 'CHAR', len: 18, refTab: '', refFld: '', desc: 'Material Number' },
            { name: 'MAKTX', key: '', rollname: 'MAKTX', type: 'CHAR', len: 40, refTab: '', refFld: '', desc: 'Material Description' },
            { name: 'WERKS', key: '', rollname: 'WERKS_D', type: 'CHAR', len: 4, refTab: '', refFld: '', desc: 'Plant' },
            { name: 'LGORT', key: '', rollname: 'LGORT_D', type: 'CHAR', len: 4, refTab: '', refFld: '', desc: 'Storage Location' },
            { name: 'LABST', key: '', rollname: 'LABST', type: 'QUAN', len: 13, refTab: 'ZMINVENT_MASTER', refFld: 'MEINS', desc: 'Valuated Stock baseline' },
            { name: 'MEINS', key: '', rollname: 'MEINS', type: 'UNIT', len: 3, refTab: '', refFld: '', desc: 'Base Unit of Measure' },
            { name: 'MIN_STOCK', key: '', rollname: 'LABST', type: 'QUAN', len: 13, refTab: 'ZMINVENT_MASTER', refFld: 'MEINS', desc: 'Safety Stock Limit' },
            { name: 'REORDER_QTY', key: '', rollname: 'LABST', type: 'QUAN', len: 13, refTab: 'ZMINVENT_MASTER', refFld: 'MEINS', desc: 'Reorder Quantity for Replenishment' },
            { name: 'ERNAM', key: '', rollname: 'ERNAM', type: 'CHAR', len: 12, refTab: '', refFld: '', desc: 'Created By' },
            { name: 'ERDAT', key: '', rollname: 'ERDAT', type: 'DATS', len: 8, refTab: '', refFld: '', desc: 'Created On' }
        ]
    },
    ZMINVENT_MOVE: {
        desc: 'Material Movements Log',
        delclass: 'A (Application table - master/trans. data)',
        dataclass: 'APPL1 (Transaction data, transparent)',
        sizecat: '2 (18,000 to 90,000 records)',
        buffering: 'Not Allowed',
        fields: [
            { name: 'MANDT', key: 'X', rollname: 'MANDT', type: 'CLNT', len: 3, refTab: '', refFld: '', desc: 'Client' },
            { name: 'MBLNR', key: 'X', rollname: 'MBLNR', type: 'CHAR', len: 10, refTab: '', refFld: '', desc: 'Material Document Number' },
            { name: 'MJAHR', key: 'X', rollname: 'MJAHR', type: 'NUMC', len: 4, refTab: '', refFld: '', desc: 'Material Document Year' },
            { name: 'ZEILE', key: 'X', rollname: 'MBLPO', type: 'NUMC', len: 4, refTab: '', refFld: '', desc: 'Item in Material Document' },
            { name: 'MATNR', key: '', rollname: 'MATNR', type: 'CHAR', len: 18, refTab: '', refFld: '', desc: 'Material Number' },
            { name: 'WERKS', key: '', rollname: 'WERKS_D', type: 'CHAR', len: 4, refTab: '', refFld: '', desc: 'Plant' },
            { name: 'LGORT', key: '', rollname: 'LGORT_D', type: 'CHAR', len: 4, refTab: '', refFld: '', desc: 'Storage Location' },
            { name: 'BWART', key: '', rollname: 'BWART', type: 'CHAR', len: 3, refTab: '', refFld: '', desc: 'Movement Type (Inventory)' },
            { name: 'SHKZG', key: '', rollname: 'SHKZG', type: 'CHAR', len: 1, refTab: '', refFld: '', desc: 'Debit/Credit Indicator (S=Receipt, H=Issue)' },
            { name: 'MENGE', key: '', rollname: 'MENGE_D', type: 'QUAN', len: 13, refTab: 'ZMINVENT_MOVE', refFld: 'MEINS', desc: 'Quantity' },
            { name: 'MEINS', key: '', rollname: 'MEINS', type: 'UNIT', len: 3, refTab: '', refFld: '', desc: 'Base Unit of Measure' },
            { name: 'CPUDT', key: '', rollname: 'CPUDT', type: 'DATS', len: 8, refTab: '', refFld: '', desc: 'Day of Posting' },
            { name: 'CPUTM', key: '', rollname: 'CPUTM', type: 'TIMS', len: 6, refTab: '', refFld: '', desc: 'Time of Posting' },
            { name: 'USNAM', key: '', rollname: 'USNAM', type: 'CHAR', len: 12, refTab: '', refFld: '', desc: 'User Name' }
        ]
    }
};

// abapGit Source Repository Structure for Viewer
const SOURCE_CODE_TEMPLATES = {
    'zcl_inventory_balance.clas.abap': `CLASS zcl_inventory_balance DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    TYPES:
      BEGIN OF ty_inventory_status,
        matnr       TYPE matnr,
        maktx       TYPE maktx,
        werks       TYPE werks_d,
        lgort       TYPE lgort_d,
        labst       TYPE labst,
        meins       TYPE meins,
        min_stock   TYPE labst,
        reorder_qty TYPE labst,
        status_icon TYPE char4,
        msg         TYPE string,
      END OF ty_inventory_status .

    CLASS-METHODS calculate_realtime_balance
      IMPORTING
        !iv_matnr         TYPE matnr
        !iv_werks         TYPE werks_d
        !iv_lgort         TYPE lgort_d
      RETURNING
        VALUE(rv_balance) TYPE labst .

    CLASS-METHODS check_safety_threshold
      IMPORTING
        !iv_matnr             TYPE matnr
        !iv_werks             TYPE werks_d
        !iv_lgort             TYPE lgort_d
      EXPORTING
        !ev_current_stock     TYPE labst
        !ev_safety_stock      TYPE labst
      RETURNING
        VALUE(rv_is_critical) TYPE abap_bool .

    CLASS-METHODS trigger_replenishment
      IMPORTING
        !iv_matnr        TYPE matnr
        !iv_werks        TYPE werks_d
        !iv_lgort        TYPE lgort_d
        !iv_req_qty      TYPE labst
      RETURNING
        VALUE(rv_banfn) TYPE banfn .
ENDCLASS.

CLASS zcl_inventory_balance IMPLEMENTATION.
  METHOD calculate_realtime_balance.
    DATA: lv_master_stock TYPE labst,
          lv_move_sum     TYPE labst,
          lt_movements    TYPE STANDARD TABLE OF zminvent_move.

    SELECT SINGLE labst FROM zminvent_master INTO lv_master_stock
      WHERE matnr = iv_matnr AND werks = iv_werks AND lgort = iv_lgort.

    SELECT * FROM zminvent_move INTO TABLE lt_movements
      WHERE matnr = iv_matnr AND werks = iv_werks AND lgort = iv_lgort.

    CLEAR lv_move_sum.
    LOOP AT lt_movements ASSIGNING FIELD-SYMBOL(<fs_move>).
      IF <fs_move>-shkzg = 'S'. " Debit (Receipt / +)
        lv_move_sum = lv_move_sum + <fs_move>-menge.
      ELSEIF <fs_move>-shkzg = 'H'. " Credit (Issue / -)
        lv_move_sum = lv_move_sum - <fs_move>-menge.
      ENDIF.
    ENDLOOP.

    rv_balance = lv_master_stock + lv_move_sum.
  ENDMETHOD.

  METHOD check_safety_threshold.
    DATA: lv_min_stock TYPE labst.

    ev_current_stock = calculate_realtime_balance(
      iv_matnr = iv_matnr iv_werks = iv_werks iv_lgort = iv_lgort
    ).

    SELECT SINGLE min_stock FROM zminvent_master INTO lv_min_stock
      WHERE matnr = iv_matnr AND werks = iv_werks AND lgort = iv_lgort.

    ev_safety_stock = lv_min_stock.

    IF ev_current_stock <= lv_min_stock.
      rv_is_critical = abap_true.
    ELSE.
      rv_is_critical = abap_false.
    ENDIF.
  ENDMETHOD.

  METHOD trigger_replenishment.
    " Simulated workflow PR creation
    CALL FUNCTION 'NUMBER_GET_NEXT'
      EXPORTING
        nr_range_nr             = '01'
        object                  = 'REQUISITION'
      IMPORTING
        number                  = rv_banfn
      EXCEPTIONS
        OTHERS                  = 1.
    IF sy-subrc <> 0.
      rv_banfn = '9000000001'.
    ENDIF.
  ENDMETHOD.
ENDCLASS.`,

    'zcl_inventory_balance.clas.xml': `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_CLAS" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <VSEOCLASS>
    <CLSNAME>ZCL_INVENTORY_BALANCE</CLSNAME>
    <VERSION>1</VERSION>
    <LANGU>E</LANGU>
    <DESCRIPT>Inventory Realtime Balance Calculator &amp; Thresholds</DESCRIPT>
    <STATE>1</STATE>
    <CLSCCINCL>X</CLSCCINCL>
    <FIXPT>X</FIXPT>
    <UNICODE>X</UNICODE>
   </VSEOCLASS>
  </asx:values>
 </asx:abap>
</abapGit>`,

    'zcl_im_inv_repl_badi.clas.abap': `CLASS zcl_im_inv_repl_badi DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    INTERFACES if_ex_mb_document_badi .
ENDCLASS.

CLASS zcl_im_inv_repl_badi IMPLEMENTATION.
  METHOD if_ex_mb_document_badi~mb_document_before_update.
    DATA: lv_is_critical   TYPE abap_bool,
          lv_current_stock TYPE labst,
          lv_safety_stock  TYPE labst,
          lv_reorder_qty   TYPE labst,
          lv_banfn         TYPE banfn,
          ls_move          TYPE zminvent_move.

    LOOP AT xmseg ASSIGNING FIELD-SYMBOL(<fs_mseg>).
      IF <fs_mseg>-shkzg = 'H'. " Goods Issue

        " Log movement
        ls_move-mandt = sy-mandt.
        ls_move-mblnr = <fs_mseg>-mblnr.
        ls_move-mjahr = <fs_mseg>-mjahr.
        ls_move-zeile = <fs_mseg>-zeile.
        ls_move-matnr = <fs_mseg>-matnr.
        ls_move-werks = <fs_mseg>-werks.
        ls_move-lgort = <fs_mseg>-lgort.
        ls_move-bwart = <fs_mseg>-bwart.
        ls_move-shkzg = <fs_mseg>-shkzg.
        ls_move-menge = <fs_mseg>-menge.
        ls_move-meins = <fs_mseg>-meins.
        ls_move-cpudt = sy-datum.
        ls_move-cputm = sy-uzeit.
        ls_move-usnam = sy-uname.
        INSERT zminvent_move FROM ls_move.

        " Evaluate stock safety threshold
        zcl_inventory_balance=>check_safety_threshold(
          EXPORTING
            iv_matnr       = <fs_mseg>-matnr
            iv_werks       = <fs_mseg>-werks
            iv_lgort       = <fs_mseg>-lgort
          IMPORTING
            ev_current_stock = lv_current_stock
            ev_safety_stock  = lv_safety_stock
          RECEIVING
            rv_is_critical = lv_is_critical
        ).

        IF lv_is_critical = abap_true.
          SELECT SINGLE reorder_qty FROM zminvent_master INTO lv_reorder_qty
            WHERE matnr = <fs_mseg>-matnr AND werks = <fs_mseg>-werks AND lgort = <fs_mseg>-lgort.

          IF lv_reorder_qty > 0.
            lv_banfn = zcl_inventory_balance=>trigger_replenishment(
              iv_matnr   = <fs_mseg>-matnr
              iv_werks   = <fs_mseg>-werks
              iv_lgort   = <fs_mseg>-lgort
              iv_req_qty = lv_reorder_qty
            ).
          ENDIF.
        ENDIF.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD if_ex_mb_document_badi~mb_document_update.
  ENDMETHOD.
ENDCLASS.`,

    'zcl_im_inv_repl_badi.clas.xml': `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_CLAS" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <VSEOCLASS>
    <CLSNAME>ZCL_IM_INV_REPL_BADI</CLSNAME>
    <VERSION>1</VERSION>
    <LANGU>E</LANGU>
    <DESCRIPT>BAdI Implementation: MB_DOCUMENT_BADI stock replenishment</DESCRIPT>
    <STATE>1</STATE>
    <CLSCCINCL>X</CLSCCINCL>
    <FIXPT>X</FIXPT>
    <UNICODE>X</UNICODE>
   </VSEOCLASS>
  </asx:values>
 </asx:abap>
</abapGit>`,

    'zinv_repl_badi.enho.xml': `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_ENHO" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <TOOL>BADI</TOOL>
   <SHORTTEXT>Automatic replenishment checking via BAdI</SHORTTEXT>
   <ORIGINAL_OBJECT>
    <PGMID>R3TR</PGMID>
    <OBJECT>ENHS</OBJECT>
    <OBJ_NAME>BADI_MATERIAL_DOCUMENT</OBJ_NAME>
    <ORG_OBJ_TYPE>ENHS</ORG_OBJ_TYPE>
    <ORG_OBJ_NAME>BADI_MATERIAL_DOCUMENT</ORG_OBJ_NAME>
    <ORG_MAIN_TYPE>ENHS</ORG_MAIN_TYPE>
    <ORG_MAIN_NAME>BADI_MATERIAL_DOCUMENT</ORG_MAIN_NAME>
    <PROGRAMNAME>SAPLMB_DOCUMENT_BADI</PROGRAMNAME>
   </ORIGINAL_OBJECT>
   <BADI_DATA>
    <ENH_BADI_IMPL_DATA>
     <IMPL_NAME>ZINV_REPL_BADI</IMPL_NAME>
     <BADI_NAME>MB_DOCUMENT_BADI</BADI_NAME>
     <IMPL_CLASS>ZCL_IM_INV_REPL_BADI</IMPL_CLASS>
     <ACTIVE>X</ACTIVE>
     <FILTER_VALUES/>
    </ENH_BADI_IMPL_DATA>
   </BADI_DATA>
  </asx:values>
 </asx:abap>
</abapGit>`,

    'zinv_alv_report.prog.abap': `*&---------------------------------------------------------------------*
*& Report ZINV_ALV_REPORT
*&---------------------------------------------------------------------*
REPORT zinv_alv_report.
TABLES: zminvent_master.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
  SELECT-OPTIONS: s_matnr FOR zminvent_master-matnr,
                  s_werks FOR zminvent_master-werks,
                  s_lgort FOR zminvent_master-lgort.
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE TEXT-002.
  PARAMETERS: p_alert AS CHECKBOX DEFAULT 'X'.
SELECTION-SCREEN END OF BLOCK b2.

CLASS lcl_report DEFINITION.
  PUBLIC SECTION.
    TYPES: BEGIN OF ty_alv_data.
             INCLUDE TYPE zcl_inventory_balance=>ty_inventory_status.
    TYPES:   color_row TYPE lvc_t_scol,
           END OF ty_alv_data.

    DATA: gt_alv_data TYPE STANDARD TABLE OF ty_alv_data,
          go_salv     TYPE REF TO cl_salv_table.

    METHODS: get_data, process_data, display_alv, set_columns, set_handlers.
    METHODS: on_double_click FOR EVENT double_click OF cl_salv_events_table IMPORTING row column,
             on_user_command FOR EVENT added_function OF cl_salv_events_table IMPORTING e_salv_function.
ENDCLASS.

CLASS lcl_report IMPLEMENTATION.
  METHOD get_data.
    SELECT * FROM zminvent_master INTO CORRESPONDING FIELDS OF TABLE gt_alv_data
      WHERE matnr IN s_matnr AND werks IN s_werks AND lgort IN s_lgort.
  ENDMETHOD.

  METHOD process_data.
    DATA: lv_is_critical TYPE abap_bool,
          lv_current_stock TYPE labst,
          lv_safety_stock TYPE labst,
          ls_color TYPE lvc_s_scol,
          lt_colors TYPE lvc_t_scol.
    FIELD-SYMBOLS: <fs_data> TYPE ty_alv_data.

    LOOP AT gt_alv_data ASSIGNING <fs_data>.
      CLEAR: lv_is_critical, lv_current_stock, lv_safety_stock, lt_colors.
      lv_is_critical = zcl_inventory_balance=>check_safety_threshold(
        EXPORTING iv_matnr = <fs_data>-matnr iv_werks = <fs_data>-werks iv_lgort = <fs_data>-lgort
        IMPORTING ev_current_stock = lv_current_stock ev_safety_stock = lv_safety_stock
      ).
      <fs_data>-labst = lv_current_stock.

      IF lv_is_critical = abap_true.
        <fs_data>-status_icon = '@0A@'. " Red LED
        <fs_data>-msg = 'CRITICAL: Below Safety Stock Threshold!'.
        ls_color-fname = ''. ls_color-color-col = 6. ls_color-color-int = 1.
        APPEND ls_color TO lt_colors. <fs_data>-color_row = lt_colors.
      ELSE.
        <fs_data>-status_icon = '@08@'. " Green LED
        <fs_data>-msg = 'Stock Normal.'.
      ENDIF.

      IF p_alert = abap_true AND lv_is_critical = abap_false.
        DELETE gt_alv_data.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

  METHOD display_alv.
    cl_salv_table=>factory( IMPORTING r_salv_table = go_salv CHANGING t_table = gt_alv_data ).
    go_salv->get_functions( )->set_all( abap_true ).
    set_columns( ). set_handlers( ).
    go_salv->display( ).
  ENDMETHOD.

  METHOD set_columns.
    DATA(lo_cols) = go_salv->get_columns( ).
    lo_cols->set_optimize( abap_true ).
    lo_cols->set_color_column( 'COLOR_ROW' ).
  ENDMETHOD.

  METHOD set_handlers.
    SET HANDLER on_double_click FOR go_salv->get_event( ).
    SET HANDLER on_user_command FOR go_salv->get_event( ).
  ENDMETHOD.

  METHOD on_double_click.
    READ TABLE gt_alv_data INTO DATA(ls_row) INDEX row.
    IF sy-subrc = 0.
      PERFORM subsub_drilldown USING ls_row-matnr.
    ENDIF.
  ENDMETHOD.

  METHOD on_user_command.
    IF e_salv_function = 'REORDER'.
      MESSAGE 'Triggering automated replenishment for critical items...' TYPE 'I'.
    ENDIF.
  ENDMETHOD.
ENDCLASS.`,

    'zinv_alv_report.prog.xml': `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_PROG" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <PROGDIR>
    <NAME>ZINV_ALV_REPORT</NAME>
    <SUBC>1</SUBC>
    <RLOAD>E</RLOAD>
    <FIXPT>X</FIXPT>
    <UCCHECK>X</UCCHECK>
   </PROGDIR>
   <TPOOL>
    <item>
     <ID>I</ID>
     <KEY>001</KEY>
     <ENTRY>Selection Criteria</ENTRY>
     <LENGTH>25</LENGTH>
    </item>
    <item>
     <ID>I</ID>
     <KEY>002</KEY>
     <ENTRY>Report Mode</ENTRY>
     <LENGTH>25</LENGTH>
    </item>
    <item>
     <ID>R</ID>
     <ENTRY>Live Inventory Monitor &amp; Replenishment Dashboard</ENTRY>
     <LENGTH>50</LENGTH>
    </item>
   </TPOOL>
  </asx:values>
 </asx:abap>
</abapGit>`,

    'zminvent_master.tabl.xml': `<!-- Custom transparent table definition ZMINVENT_MASTER -->
<TABNAME>ZMINVENT_MASTER</TABNAME>
<TABCLASS>TRANSP</TABCLASS>
<DDTEXT>Material Master Safety Stock and Current Inventory</DDTEXT>
<FIELDS>
  <FIELD><NAME>MANDT</NAME><KEY>X</KEY><ROLLNAME>MANDT</ROLLNAME></FIELD>
  <FIELD><NAME>MATNR</NAME><KEY>X</KEY><ROLLNAME>MATNR</ROLLNAME></FIELD>
  <FIELD><NAME>MAKTX</NAME><ROLLNAME>MAKTX</ROLLNAME></FIELD>
  <FIELD><NAME>WERKS</NAME><ROLLNAME>WERKS_D</ROLLNAME></FIELD>
  <FIELD><NAME>LGORT</NAME><ROLLNAME>LGORT_D</ROLLNAME></FIELD>
  <FIELD><NAME>LABST</NAME><ROLLNAME>LABST</ROLLNAME></FIELD>
  <FIELD><NAME>MEINS</NAME><ROLLNAME>MEINS</ROLLNAME></FIELD>
  <FIELD><NAME>MIN_STOCK</NAME><ROLLNAME>LABST</ROLLNAME></FIELD>
  <FIELD><NAME>REORDER_QTY</NAME><ROLLNAME>LABST</ROLLNAME></FIELD>
</FIELDS>`,

    'zminvent_move.tabl.xml': `<!-- Custom transparent table definition ZMINVENT_MOVE -->
<TABNAME>ZMINVENT_MOVE</TABNAME>
<TABCLASS>TRANSP</TABCLASS>
<DDTEXT>Material Movements Log</DDTEXT>
<FIELDS>
  <FIELD><NAME>MANDT</NAME><KEY>X</KEY><ROLLNAME>MANDT</ROLLNAME></FIELD>
  <FIELD><NAME>MBLNR</NAME><KEY>X</KEY><ROLLNAME>MBLNR</ROLLNAME></FIELD>
  <FIELD><NAME>MJAHR</NAME><KEY>X</KEY><ROLLNAME>MJAHR</ROLLNAME></FIELD>
  <FIELD><NAME>ZEILE</NAME><KEY>X</KEY><ROLLNAME>MBLPO</ROLLNAME></FIELD>
  <FIELD><NAME>MATNR</NAME><ROLLNAME>MATNR</ROLLNAME></FIELD>
  <FIELD><NAME>BWART</NAME><ROLLNAME>BWART</ROLLNAME></FIELD>
  <FIELD><NAME>SHKZG</NAME><ROLLNAME>SHKZG</ROLLNAME></FIELD>
  <FIELD><NAME>MENGE</NAME><ROLLNAME>MENGE_D</ROLLNAME></FIELD>
  <FIELD><NAME>MEINS</NAME><ROLLNAME>MEINS</ROLLNAME></FIELD>
</FIELDS>`,

    'abapgit.xml': `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <DATAINGIT>
    <FOLDER_LOGIC>PREFIX</FOLDER_LOGIC>
    <STARTING_FOLDER>/src/</STARTING_FOLDER>
   </DATAINGIT>
  </asx:values>
 </asx:abap>
</abapGit>`
};

// Track modified files for local git status
let repoFiles = JSON.parse(localStorage.getItem('sap_git_files')) || {};
let gitCommits = JSON.parse(localStorage.getItem('sap_git_commits')) || [
    { hash: 'e5b7c12', author: 'DEVELOPER_ABAP', date: '2026-06-25 09:12', msg: 'Initial commit: Custom Data Dictionary tables structure' },
    { hash: 'a12f90b', author: 'DEVELOPER_ABAP', date: '2026-06-26 15:40', msg: 'Added OO-ABAP ZCL_INVENTORY_BALANCE for stock logic' },
    { hash: 'd5c2104', author: 'DEVELOPER_ABAP', date: '2026-06-27 11:22', msg: 'Implemented MB_DOCUMENT_BADI replenishment triggering' },
    { hash: 'f9d34b1', author: 'DEVELOPER_ABAP', date: '2026-06-28 17:05', msg: 'Created CL_SALV_TABLE based report ZINV_ALV_REPORT' }
];

let selectedFile = 'zcl_inventory_balance.clas.abap';
let selectedDdicTable = 'ZMINVENT_MASTER';

// --- APPLICATION INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupNavigation();
    setupDashboard();
    setupALVGrid();
    setupMIGO();
    setupDDICExplorer();
    setupCodeViewer();
    setupAbapGit();
    setupTheme();
});

// --- CORE UTILITIES ---
function initApp() {
    // Populate select elements
    populateMaterialSelects();
    updateFioriKPIs();
}

function setupTheme() {
    const themeCheckbox = document.getElementById('theme-checkbox');
    const themeSwitch = document.getElementById('theme-switch');

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        themeCheckbox.checked = false;
    }

    themeCheckbox.addEventListener('change', () => {
        if (themeCheckbox.checked) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('app_theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            localStorage.setItem('app_theme', 'light');
        }
    });

    themeSwitch.addEventListener('click', (e) => {
        if (e.target !== themeCheckbox && !e.target.closest('.slider')) {
            themeCheckbox.checked = !themeCheckbox.checked;
            themeCheckbox.dispatchEvent(new Event('change'));
        }
    });
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const viewports = document.querySelectorAll('.tab-viewport');
    const titleEl = document.getElementById('current-tab-title');
    const subtitleEl = document.getElementById('current-tab-subtitle');

    const meta = {
        'dashboard': { title: 'Overview Dashboard', subtitle: 'Real-time metrics, active alerts, and automation status' },
        'alv-report': { title: 'ALV Grid Report Display', subtitle: 'Program: ZINV_ALV_REPORT - Live inventory levels monitor' },
        'migo-transaction': { title: 'Post Goods Movement', subtitle: 'Transaction MIGO - Standard SAP goods movements simulator' },
        'ddic-explorer': { title: 'ABAP Dictionary Explorer', subtitle: 'Custom database definitions and validations' },
        'code-viewer': { title: 'ABAP Source Code Viewer', subtitle: 'Review serialized abapGit objects in local repository' },
        'abapgit-panel': { title: 'abapGit Version Control', subtitle: 'Synchronize local SAP objects with remote Git repo' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            viewports.forEach(v => v.classList.remove('active'));
            document.getElementById(`viewport-${targetTab}`).classList.add('active');

            titleEl.textContent = meta[targetTab].title;
            subtitleEl.textContent = meta[targetTab].subtitle;

            // Trigger specific refreshes if needed
            if (targetTab === 'alv-report') {
                renderALVGrid();
            } else if (targetTab === 'abapgit-panel') {
                renderGitStatus();
                renderGitLog();
            } else if (targetTab === 'dashboard') {
                updateFioriKPIs();
            }
        });
    });

    // Handle jump buttons on dashboard
    document.querySelectorAll('.btn-tab-jump').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            const navBtn = document.querySelector(`.nav-item[data-tab="${targetTab}"]`);
            if (navBtn) navBtn.click();
        });
    });
}

// --- KPI CALCULATIONS ---
function updateFioriKPIs() {
    document.getElementById('dash-total-sku').textContent = masterData.length;
    
    // Calculate alerts (how many materials are currently <= safety stock)
    let alertCount = 0;
    masterData.forEach(mat => {
        const stock = getRealtimeStock(mat.matnr);
        if (stock <= mat.min_stock) {
            alertCount++;
        }
    });

    const alertTile = document.getElementById('dash-card-alerts');
    const alertValueEl = document.getElementById('dash-active-alerts');
    alertValueEl.textContent = alertCount;
    if (alertCount > 0) {
        alertTile.classList.add('pulse-alert');
    } else {
        alertTile.classList.remove('pulse-alert');
    }

    document.getElementById('dash-pending-replenish').textContent = pendingReplenishmentsCount;
    document.getElementById('dash-movements-count').textContent = movementsData.length;
}

// Helper to calculate realtime balance (combines master base + movements)
function getRealtimeStock(matnr) {
    const mat = masterData.find(m => m.matnr === matnr);
    if (!mat) return 0;

    let balance = mat.labst;
    movementsData.forEach(move => {
        if (move.matnr === matnr) {
            if (move.shkzg === 'S') {
                balance += move.menge;
            } else if (move.shkzg === 'H') {
                balance -= move.menge;
            }
        }
    });
    return balance;
}

function populateMaterialSelects() {
    const selMatnr = document.getElementById('sel-matnr');
    const migoMatnr = document.getElementById('migo-matnr');

    // Clear options
    selMatnr.innerHTML = '<option value="ALL">* (All Materials)</option>';
    migoMatnr.innerHTML = '';

    masterData.forEach(mat => {
        // Report selector
        const opt1 = document.createElement('option');
        opt1.value = mat.matnr;
        opt1.textContent = `${mat.matnr} - ${mat.maktx}`;
        selMatnr.appendChild(opt1);

        // MIGO selector
        const opt2 = document.createElement('option');
        opt2.value = mat.matnr;
        opt2.textContent = `${mat.matnr} - ${mat.maktx}`;
        migoMatnr.appendChild(opt2);
    });
}

// --- 2. ALV REPORT CONTROLLER ---
function setupALVGrid() {
    // Collapsible selection screen
    const selectHeader = document.getElementById('toggle-selection-btn');
    const selectBody = document.getElementById('selection-form-body');
    const icon = selectHeader.querySelector('.collapse-icon i');

    selectHeader.addEventListener('click', () => {
        selectBody.classList.toggle('collapsed');
        if (selectBody.classList.contains('collapsed')) {
            icon.className = 'fa-solid fa-chevron-down';
        } else {
            icon.className = 'fa-solid fa-chevron-up';
        }
    });

    // Execute button
    document.getElementById('btn-run-report').addEventListener('click', () => {
        renderALVGrid();
        // Collapse selection after run
        selectBody.classList.add('collapsed');
        icon.className = 'fa-solid fa-chevron-down';
    });

    // Reset selection button
    document.getElementById('btn-reset-report').addEventListener('click', () => {
        document.getElementById('sel-matnr').value = 'ALL';
        document.getElementById('sel-werks').value = '1000';
        document.getElementById('sel-lgort').value = '0001';
        document.getElementById('sel-alerts-only').checked = false;
        renderALVGrid();
    });

    // Search filter
    document.getElementById('alv-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        filterALVGrid(query);
    });

    // Toolbar sorting
    let sortAsc = true;
    document.getElementById('alv-sort-asc').addEventListener('click', () => sortALV('labst', true));
    document.getElementById('alv-sort-desc').addEventListener('click', () => sortALV('labst', false));

    // Reset stock to baseline
    document.getElementById('alv-reset-stock').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset inventory stock and delete movement logs to baseline levels?')) {
            localStorage.removeItem('sap_master_data');
            localStorage.removeItem('sap_movements_data');
            localStorage.removeItem('sap_pending_repl');
            masterData = [...INITIAL_MASTER];
            movementsData = [...INITIAL_MOVEMENTS];
            pendingReplenishmentsCount = 0;
            updateFioriKPIs();
            populateMaterialSelects();
            renderALVGrid();
            
            // clear terminals
            document.getElementById('badi-terminal').innerHTML = `
                <div class="terminal-welcome">
                    <p class="text-orange">// SAP BAdI Engine Monitor Online</p>
                    <p class="text-muted">Waiting for Goods Movement posting trigger...</p>
                </div>`;
            alert('Database tables ZMINVENT_MASTER and ZMINVENT_MOVE reset to initial values.');
        }
    });

    // Manual replenishment order
    document.getElementById('alv-manual-reorder').addEventListener('click', () => {
        let count = 0;
        masterData.forEach(mat => {
            const stock = getRealtimeStock(mat.matnr);
            if (stock <= mat.min_stock && !mat.pr) {
                // Trigger replenishment
                const prNum = '900' + Math.floor(1000000 + Math.random() * 9000000);
                mat.pr = prNum;
                pendingReplenishmentsCount++;
                count++;
            }
        });

        if (count > 0) {
            localStorage.setItem('sap_master_data', JSON.stringify(masterData));
            localStorage.setItem('sap_pending_repl', pendingReplenishmentsCount.toString());
            updateFioriKPIs();
            renderALVGrid();
            alert(`Triggered replenishment workflow. Created ${count} Purchase Requisitions.`);
        } else {
            alert('No items are currently breaching safety stock limits, or alerts already have active PR numbers.');
        }
    });

    // Modal close hooks
    document.getElementById('btn-close-modal').addEventListener('click', hideDrilldownModal);
    document.getElementById('btn-close-modal-footer').addEventListener('click', hideDrilldownModal);

    // Initial render
    renderALVGrid();
}

function renderALVGrid() {
    const tbody = document.getElementById('alv-tbody');
    tbody.innerHTML = '';

    const filterMat = document.getElementById('sel-matnr').value;
    const filterWerks = document.getElementById('sel-werks').value.trim().toUpperCase();
    const filterLgort = document.getElementById('sel-lgort').value.trim().toUpperCase();
    const alertsOnly = document.getElementById('sel-alerts-only').checked;

    masterData.forEach(mat => {
        // Selection criteria filters
        if (filterMat !== 'ALL' && mat.matnr !== filterMat) return;
        if (filterWerks && mat.werks.toUpperCase() !== filterWerks) return;
        if (filterLgort && mat.lgort.toUpperCase() !== filterLgort) return;

        const currentStock = getRealtimeStock(mat.matnr);
        const isCritical = currentStock <= mat.min_stock;

        if (alertsOnly && !isCritical) return;

        const row = document.createElement('tr');
        if (isCritical) {
            row.className = 'sap-row-alert';
        }

        row.innerHTML = `
            <td class="col-icon">
                <span class="led-indicator ${isCritical ? 'red' : 'green'}"></span>
            </td>
            <td><strong>${mat.matnr}</strong></td>
            <td>${mat.maktx}</td>
            <td>${mat.werks}</td>
            <td>${mat.lgort}</td>
            <td class="text-right"><strong>${currentStock}</strong></td>
            <td>${mat.meins}</td>
            <td class="text-right">${mat.min_stock}</td>
            <td class="text-right">${mat.reorder_qty}</td>
            <td><span class="${mat.pr ? 'text-orange font-bold' : 'text-muted'}">${mat.pr || 'None'}</span></td>
            <td>${isCritical ? `<span class="text-red font-bold"><i class="fa-solid fa-triangle-exclamation"></i> Low Stock Alert</span>` : '<span class="text-green"><i class="fa-solid fa-circle-check"></i> Normal</span>'}</td>
        `;

        // Drill down event listener (double click)
        row.addEventListener('dblclick', () => {
            showDrilldownModal(mat.matnr);
        });

        tbody.appendChild(row);
    });

    if (tbody.innerHTML === '') {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No records match the selection criteria.</td></tr>';
    }
}

function filterALVGrid(query) {
    const rows = document.querySelectorAll('#alv-tbody tr');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function sortALV(column, ascending) {
    // Sort logic
    masterData.sort((a, b) => {
        let valA = (column === 'labst') ? getRealtimeStock(a.matnr) : a[column];
        let valB = (column === 'labst') ? getRealtimeStock(b.matnr) : b[column];
        
        if (valA < valB) return ascending ? -1 : 1;
        if (valA > valB) return ascending ? 1 : -1;
        return 0;
    });
    renderALVGrid();
}

// --- Secondary Drilldown ALV Window ---
function showDrilldownModal(matnr) {
    const mat = masterData.find(m => m.matnr === matnr);
    if (!mat) return;

    document.getElementById('modal-matnr').textContent = mat.matnr;
    document.getElementById('modal-maktx').textContent = mat.maktx;

    const tbody = document.getElementById('modal-alv-tbody');
    tbody.innerHTML = '';

    // Filter movements list for this material
    const filteredMovements = movementsData.filter(m => m.matnr === matnr);

    filteredMovements.forEach(move => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${move.mblnr}</td>
            <td>${move.mjahr}</td>
            <td>${move.zeile}</td>
            <td><strong>${move.bwart}</strong></td>
            <td><span class="${move.shkzg === 'S' ? 'text-green font-bold' : 'text-red font-bold'}">${move.shkzg === 'S' ? '+' : '-'}</span></td>
            <td class="text-right"><strong>${move.menge}</strong></td>
            <td>${move.meins}</td>
            <td>${move.cpudt}</td>
            <td>${move.cputm}</td>
            <td>${move.usnam}</td>
        `;
        tbody.appendChild(tr);
    });

    if (tbody.innerHTML === '') {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No movements recorded.</td></tr>';
    }

    document.getElementById('alv-drilldown-modal').classList.remove('hide');
}

function hideDrilldownModal() {
    document.getElementById('alv-drilldown-modal').classList.add('hide');
}

// --- 3. MIGO POST MOVEMENT CONTROLLER ---
function setupMIGO() {
    const form = document.getElementById('migo-form');
    const selectMat = document.getElementById('migo-matnr');
    const uomInput = document.getElementById('migo-uom');

    // Update UoM field when material changes
    selectMat.addEventListener('change', () => {
        const mat = masterData.find(m => m.matnr === selectMat.value);
        if (mat) {
            uomInput.value = mat.meins;
        }
    });

    // Form submit listener
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const matnr = selectMat.value;
        const qty = parseInt(document.getElementById('migo-menge').value);
        const bwartSel = document.getElementById('migo-bwart');
        const bwart = bwartSel.value;
        const shkzg = bwartSel.options[bwartSel.selectedIndex].getAttribute('data-shkzg');
        const user = document.getElementById('migo-usnam').value;
        const uom = uomInput.value;

        // Perform goods movement posting simulation
        runGoodsMovementSimulation(matnr, qty, bwart, shkzg, user, uom);
    });

    // Clear logs button
    document.getElementById('clear-badi-logs').addEventListener('click', () => {
        document.getElementById('badi-terminal').innerHTML = `
            <div class="terminal-welcome">
                <p class="text-orange">// SAP BAdI Engine Monitor Online</p>
                <p class="text-muted">Waiting for Goods Movement posting trigger...</p>
            </div>`;
    });
}

function runGoodsMovementSimulation(matnr, qty, bwart, shkzg, user, uom) {
    const term = document.getElementById('badi-terminal');
    term.innerHTML = ''; // Clear prior logs

    const btnPost = document.getElementById('btn-post-migo');
    btnPost.disabled = true;

    // Define simulation steps
    const mblnr = '4900' + Math.floor(100000 + Math.random() * 900000);
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('de-DE');

    const logs = [
        { text: `[0.00s] SYSTEM: Calling standard API MB_CREATE_GOODS_MOVEMENT...`, delay: 0 },
        { text: `[0.15s] BAdI: Intercepting movement header & items. Loading MB_DOCUMENT_BADI...`, delay: 150 },
        { text: `[0.35s] BAdI: Active implementation found: ZINV_REPL_BADI. Firing before_update...`, delay: 350 },
        { text: `[0.55s] ZINV_REPL_BADI: Intercepted Material=${matnr}, BWART=${bwart}, Qty=${qty} ${uom}`, delay: 550 },
        { text: `[0.75s] ZINV_REPL_BADI: Logging document ${mblnr}/2026/0001 into custom table ZMINVENT_MOVE...`, delay: 750 },
        { text: `[0.95s] ZINV_REPL_BADI: Executing check via class ZCL_INVENTORY_BALANCE=>CHECK_SAFETY_THRESHOLD...`, delay: 950 }
    ];

    // Add calculations log
    const baseStock = masterData.find(m => m.matnr === matnr).labst;
    
    // Calculate current stock before delta
    let previousStock = baseStock;
    movementsData.forEach(m => {
        if (m.matnr === matnr) {
            previousStock += (m.shkzg === 'S') ? m.menge : -m.menge;
        }
    });

    const newStock = previousStock + ((shkzg === 'S') ? qty : -qty);
    const minStock = masterData.find(m => m.matnr === matnr).min_stock;
    const reorderQty = masterData.find(m => m.matnr === matnr).reorder_qty;

    logs.push({
        text: `[1.15s] ZCL_INVENTORY_BALANCE: Calculated stock delta. Previous Stock=${previousStock} -> New Balance=${newStock} (Unit=${uom})`,
        delay: 1150
    });
    logs.push({
        text: `[1.30s] ZCL_INVENTORY_BALANCE: Checking Safety Threshold. Current Stock (${newStock}) <= Safety Stock Limit (${minStock})`,
        delay: 1300
    });

    const isCritical = newStock <= minStock;
    let prCreated = false;
    let prNum = '';

    if (isCritical && shkzg === 'H') {
        // Stock falls below safety limit! Trigger replenishment
        prNum = '900' + Math.floor(1000000 + Math.random() * 9000000);
        logs.push({
            text: `[1.50s] ALERT: SAFETY STOCK BREACHED! Firing replenishment trigger...`,
            class: 'text-red',
            delay: 1500
        });
        logs.push({
            text: `[1.70s] ZINV_REPL_BADI: Calling ZCL_INVENTORY_BALANCE=>TRIGGER_REPLENISHMENT (Qty=${reorderQty})...`,
            delay: 1700
        });
        logs.push({
            text: `[1.95s] ZCL_INVENTORY_BALANCE: Creating standard purchase requisition document in SAP...`,
            delay: 1950
        });
        logs.push({
            text: `[2.25s] SUCCESS: Requisition ${prNum} generated. Triggering SAP workflow standard event 'CREATED' on BOR BUS2009.`,
            class: 'text-green',
            delay: 2250
        });
        prCreated = true;
    } else {
        logs.push({
            text: `[1.50s] CHECK: Stock levels are healthy. No replenishment workflow needed.`,
            class: 'text-green',
            delay: 1500
        });
    }

    logs.push({ text: `[2.45s] BAdI: Completed method MB_DOCUMENT_BEFORE_UPDATE. Continuing core update task...`, delay: 2450 });
    logs.push({ text: `[2.65s] SYSTEM: Executing database COMMIT WORK...`, delay: 2650 });
    logs.push({ text: `[2.80s] SYSTEM: Movement successfully posted! Document details: Doc ${mblnr} Year 2026.`, class: 'text-orange', delay: 2800 });

    // Print lines dynamically to simulate SAP job run
    logs.forEach(log => {
        setTimeout(() => {
            const line = document.createElement('p');
            line.className = 'terminal-line ' + (log.class || 'text-muted');
            line.innerHTML = log.text;
            term.appendChild(line);
            term.scrollTop = term.scrollHeight;
        }, log.delay);
    });

    // Execute actual DB updates at the end of the simulation
    setTimeout(() => {
        // Append movement
        const newMovement = {
            mblnr: mblnr,
            mjahr: '2026',
            zeile: '0001',
            matnr: matnr,
            werks: '1000',
            lgort: '0001',
            bwart: bwart,
            shkzg: shkzg,
            menge: qty,
            meins: uom,
            cpudt: dateStr,
            cputm: timeStr,
            usnam: user
        };
        movementsData.push(newMovement);
        localStorage.setItem('sap_movements_data', JSON.stringify(movementsData));

        // Update PR field if triggered
        if (prCreated) {
            const matIndex = masterData.findIndex(m => m.matnr === matnr);
            if (matIndex !== -1) {
                masterData[matIndex].pr = prNum;
                localStorage.setItem('sap_master_data', JSON.stringify(masterData));
            }
            pendingReplenishmentsCount++;
            localStorage.setItem('sap_pending_repl', pendingReplenishmentsCount.toString());
        }

        // Re-enable post button
        btnPost.disabled = false;
        
        // Refresh views
        updateFioriKPIs();
        renderALVGrid();

        alert(`Goods Movement posted successfully! Material Document ${mblnr} created.`);
    }, 2900);
}

// --- 4. DDIC EXPLORER CONTROLLER ---
function setupDDICExplorer() {
    const btnMaster = document.getElementById('ddic-tab-master');
    const btnMove = document.getElementById('ddic-tab-move');

    btnMaster.addEventListener('click', () => {
        switchDdicTable('ZMINVENT_MASTER');
        btnMaster.classList.add('active');
        btnMove.classList.remove('active');
    });

    btnMove.addEventListener('click', () => {
        switchDdicTable('ZMINVENT_MOVE');
        btnMove.classList.add('active');
        btnMaster.classList.remove('active');
    });

    // Render ZMINVENT_MASTER initially
    switchDdicTable('ZMINVENT_MASTER');
}

function switchDdicTable(tablename) {
    selectedDdicTable = tablename;
    const table = DDIC_TABLES[tablename];

    document.getElementById('ddic-table-name').textContent = tablename;
    document.getElementById('ddic-table-desc').textContent = table.desc;
    document.getElementById('ddic-delclass').textContent = table.delclass;
    document.getElementById('ddic-dataclass').textContent = table.dataclass;
    document.getElementById('ddic-sizecat').textContent = table.sizecat;
    document.getElementById('ddic-buffering').textContent = table.buffering;

    const tbody = document.getElementById('ddic-fields-tbody');
    tbody.innerHTML = '';

    table.fields.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${f.name}</strong></td>
            <td class="text-center"><span class="${f.key ? 'text-orange' : 'text-muted'}">${f.key ? '<i class="fa-solid fa-key"></i>' : ''}</span></td>
            <td><span class="text-accent">${f.rollname}</span></td>
            <td>${f.type}</td>
            <td>${f.len}</td>
            <td>${f.refTab}</td>
            <td>${f.refFld}</td>
            <td>${f.desc}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- 5. ABAP CODE EXPLORER CONTROLLER ---
function setupCodeViewer() {
    const listItems = document.querySelectorAll('.code-tree-item');
    const preContent = document.getElementById('code-content');
    const textarea = document.getElementById('code-textarea');
    const filenameEl = document.getElementById('current-filename');
    const badgeEl = document.getElementById('editor-saved-badge');
    const editToggle = document.getElementById('btn-edit-code-toggle');
    const editFooter = document.getElementById('editor-edit-footer');

    // Read initial source code from templates
    const loadedFiles = JSON.parse(localStorage.getItem('sap_source_files')) || {...SOURCE_CODE_TEMPLATES};

    // Load active file code
    function loadFileCode(filename) {
        selectedFile = filename;
        const code = loadedFiles[filename];

        filenameEl.textContent = filename;
        
        // Highlight logic
        preContent.innerHTML = syntaxHighlightABAP(code, filename);
        textarea.value = code;

        // Reset editing state
        textarea.classList.add('hide');
        preContent.classList.remove('hide');
        editFooter.classList.add('hide');
        badgeEl.textContent = 'Read Only';
        badgeEl.className = 'badge badge-success';
        editToggle.innerHTML = '<i class="fa-solid fa-pencil"></i> Edit Mock Code';
    }

    listItems.forEach(item => {
        item.addEventListener('click', () => {
            listItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            const file = item.getAttribute('data-file');
            loadFileCode(file);
        });
    });

    // Copy to clipboard
    document.getElementById('btn-copy-code').addEventListener('click', () => {
        const text = loadedFiles[selectedFile];
        navigator.clipboard.writeText(text).then(() => {
            alert('File contents copied to clipboard!');
        });
    });

    // Toggle editing mode
    editToggle.addEventListener('click', () => {
        const isEditing = !preContent.classList.contains('hide');

        if (isEditing) {
            // Enter edit mode
            preContent.classList.add('hide');
            textarea.classList.remove('hide');
            editFooter.classList.remove('hide');
            badgeEl.textContent = 'Editing Mode';
            badgeEl.className = 'badge badge-sap';
            editToggle.innerHTML = '<i class="fa-solid fa-eye"></i> View Highlighted';
        } else {
            // Exit edit mode without saving
            loadFileCode(selectedFile);
        }
    });

    // Cancel edit
    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
        loadFileCode(selectedFile);
    });

    // Save changes
    document.getElementById('btn-save-code').addEventListener('click', () => {
        const newCode = textarea.value;
        
        // Save to state
        loadedFiles[selectedFile] = newCode;
        localStorage.setItem('sap_source_files', JSON.stringify(loadedFiles));

        // Mark as modified in Git Status
        repoFiles[selectedFile] = 'modified';
        localStorage.setItem('sap_git_files', JSON.stringify(repoFiles));

        // Update git status icons
        const gitStatusIcon = document.getElementById('git-status-icon');
        gitStatusIcon.textContent = 'Drifted';
        gitStatusIcon.className = 'git-synced-indicator drifted';

        loadFileCode(selectedFile);
        alert(`Mock modifications saved to ${selectedFile}. Sync changes in the abapGit tab!`);
    });

    // Initial load
    loadFileCode(selectedFile);
}

// Basic Syntax Highlighter helper for the UI
function syntaxHighlightABAP(code, filename) {
    if (filename.endsWith('.xml')) {
        // XML highlight
        return code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/(&lt;\/?[a-zA-Z0-9_:\-]+&gt;)/g, '<span class="syntax-xml-tag">$1</span>')
            .replace(/(\s[a-zA-Z0-9_:\-]+=)/g, '<span class="syntax-xml-attr">$1</span>')
            .replace(/(="[^"]*")/g, '<span class="syntax-string">$1</span>');
    }

    // Escape HTML first
    let escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // ABAP highlight keywords
    const keywords = [
        'CLASS', 'DEFINITION', 'PUBLIC', 'FINAL', 'CREATE', 'SECTION', 'TYPES', 'BEGIN', 'OF', 'END', 'CLASS-METHODS',
        'IMPORTING', 'EXPORTING', 'RETURNING', 'VALUE', 'TYPE', 'INTERFACES', 'IMPLEMENTATION', 'METHOD', 'ENDMETHOD',
        'DATA', 'SELECT', 'SINGLE', 'FROM', 'INTO', 'WHERE', 'AND', 'TABLE', 'CLEAR', 'LOOP', 'AT', 'ASSIGNING',
        'FIELD-SYMBOL', 'IF', 'ELSEIF', 'ELSE', 'ENDIF', 'ENDCLASS', 'CALL', 'FUNCTION', 'EXCEPTIONS', 'OTHERS',
        'REPORT', 'TABLES', 'SELECTION-SCREEN', 'BLOCK', 'WITH', 'FRAME', 'TITLE', 'PARAMETERS', 'CHECKBOX',
        'DEFAULT', 'SELECT-OPTIONS', 'FOR', 'TRY', 'CATCH', 'MESSAGE', 'FORM', 'ENDFORM', 'PERFORM', 'USING',
        'START-OF-SELECTION', 'NEW', 'CONV', 'CASE', 'WHEN', 'ENDCASE'
    ];

    const keywordRegex = new RegExp('\\b(' + keywords.join('|') + ')\\b', 'gi');
    escaped = escaped.replace(keywordRegex, '<span class="syntax-keyword">$1</span>');

    // Highlight comments (lines starting with * or containing ")
    escaped = escaped.replace(/(^\*.*$)/gm, '<span class="syntax-comment">$1</span>');
    escaped = escaped.replace(/("[^"\n]*$)/gm, '<span class="syntax-comment">$1</span>');

    // Highlight strings
    escaped = escaped.replace(/('[^'\n]*')/g, '<span class="syntax-string">$1</span>');

    // Highlight class methods calls
    escaped = escaped.replace(/(=&gt;|-\&gt;)([a-zA-Z0-9_]+)/g, '$1<span class="syntax-method">$2</span>');

    return escaped;
}

// --- 6. ABAPGIT CONTROL PANEL CONTROLLER ---
function setupAbapGit() {
    document.getElementById('git-btn-refresh').addEventListener('click', () => {
        renderGitStatus();
    });

    document.getElementById('git-btn-commit').addEventListener('click', () => {
        const commitMsg = prompt('Enter git commit message:');
        if (commitMsg && commitMsg.trim() !== '') {
            // Execute commit
            const hash = Math.random().toString(16).substring(2, 9);
            const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
            
            gitCommits.unshift({
                hash: hash,
                author: 'DEVELOPER_ABAP',
                date: dateStr,
                msg: commitMsg
            });

            localStorage.setItem('sap_git_commits', JSON.stringify(gitCommits));

            // Reset modified files
            repoFiles = {};
            localStorage.setItem('sap_git_files', JSON.stringify(repoFiles));

            // Reset sync badge
            const gitStatusIcon = document.getElementById('git-status-icon');
            gitStatusIcon.textContent = 'Synced';
            gitStatusIcon.className = 'git-synced-indicator synced';

            renderGitStatus();
            renderGitLog();
            updateFioriKPIs();

            alert('Local changes committed to Git repository!');
        }
    });

    // Check status on load
    renderGitStatus();
    renderGitLog();
}

function renderGitStatus() {
    const body = document.getElementById('git-files-body');
    const commitBtn = document.getElementById('git-btn-commit');
    const pushBtn = document.getElementById('git-btn-push');
    const unstagedCountEl = document.getElementById('git-unstaged-count');
    const stagedCountEl = document.getElementById('git-staged-count');

    const changedFiles = Object.keys(repoFiles);
    
    unstagedCountEl.textContent = changedFiles.length;
    stagedCountEl.textContent = changedFiles.length; // abapGit stages immediately on commit trigger

    if (changedFiles.length > 0) {
        commitBtn.disabled = false;
        pushBtn.disabled = false;
        
        body.innerHTML = '';
        changedFiles.forEach(file => {
            const ext = file.split('.').pop().toUpperCase();
            
            // Map extensions to SAP tags
            let sapTag = 'clas';
            if (file.includes('tabl')) sapTag = 'tabl';
            else if (file.includes('enho')) sapTag = 'enho';
            else if (file.includes('prog')) sapTag = 'prog';
            else if (file.endsWith('.xml')) sapTag = 'xml';

            const row = document.createElement('div');
            row.className = 'git-file-row';
            row.innerHTML = `
                <span><strong>src/${file}</strong></span>
                <span><span class="sap-object-tag ${sapTag}">${sapTag.toUpperCase()}</span></span>
                <span><span class="git-status-flag modified">Modified</span></span>
                <span><span class="git-status-flag staged">Staged</span></span>
            `;
            body.appendChild(row);
        });

        // Set global drifted icon
        const gitStatusIcon = document.getElementById('git-status-icon');
        gitStatusIcon.textContent = 'Drifted';
        gitStatusIcon.className = 'git-synced-indicator drifted';
    } else {
        commitBtn.disabled = true;
        pushBtn.disabled = true;
        
        body.innerHTML = `
            <div class="git-empty-state">
                <i class="fa-solid fa-circle-check text-green"></i>
                <p>SAP DB is fully synchronized with the Git repository. No local changes detected.</p>
                <span class="tip-text">Try editing one of the source code files in the <strong>ABAP Source Code</strong> tab to simulate local drift!</span>
            </div>
        `;

        // Sync header icon
        const gitStatusIcon = document.getElementById('git-status-icon');
        gitStatusIcon.textContent = 'Synced';
        gitStatusIcon.className = 'git-synced-indicator synced';
    }
}

function renderGitLog() {
    const timeline = document.getElementById('git-log-timeline');
    timeline.innerHTML = '';
    
    document.getElementById('git-commit-count').textContent = gitCommits.length;

    gitCommits.forEach(commit => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-header">
                <span class="commit-hash"><i class="fa-solid fa-hashtag"></i> ${commit.hash}</span>
                <span class="commit-date">${commit.date}</span>
            </div>
            <p class="commit-msg">${commit.msg}</p>
            <p class="commit-author">by ${commit.author}</p>
        `;
        timeline.appendChild(item);
    });
}
