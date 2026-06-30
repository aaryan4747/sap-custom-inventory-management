CLASS zcl_inventory_balance DEFINITION
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
        status_icon TYPE char4, " Icon for UI reporting
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
        VALUE(rv_banfn) TYPE banfn . " Returns Purchase Requisition number
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.



CLASS zcl_inventory_balance IMPLEMENTATION.


  METHOD calculate_realtime_balance.
    DATA: lv_master_stock TYPE labst,
          lv_move_sum     TYPE labst,
          lt_movements    TYPE STANDARD TABLE OF zminvent_move.

    " 1. Read baseline stock from Master Table
    SELECT SINGLE labst FROM zminvent_master
      INTO lv_master_stock
      WHERE matnr = iv_matnr
        AND werks = iv_werks
        AND lgort = iv_lgort.

    " 2. Accumulate movements from Transaction Table
    SELECT * FROM zminvent_move
      INTO TABLE lt_movements
      WHERE matnr = iv_matnr
        AND werks = iv_werks
        AND lgort = iv_lgort.

    CLEAR lv_move_sum.
    LOOP AT lt_movements ASSIGNING FIELD-SYMBOL(<fs_move>).
      IF <fs_move>-shkzg = 'S'. " Debit (Goods Receipt / +)
        lv_move_sum = lv_move_sum + <fs_move>-menge.
      ELSEIF <fs_move>-shkzg = 'H'. " Credit (Goods Issue / -)
        lv_move_sum = lv_move_sum - <fs_move>-menge.
      ENDIF.
    ENDLOOP.

    " 3. Realtime stock = baseline master stock + movement delta
    rv_balance = lv_master_stock + lv_move_sum.

  ENDMETHOD.


  METHOD check_safety_threshold.
    DATA: lv_min_stock TYPE labst.

    " Get current realtime balance
    ev_current_stock = calculate_realtime_balance(
      iv_matnr = iv_matnr
      iv_werks = iv_werks
      iv_lgort = iv_lgort
    ).

    " Read safety threshold limit
    SELECT SINGLE min_stock FROM zminvent_master
      INTO lv_min_stock
      WHERE matnr = iv_matnr
        AND werks = iv_werks
        AND lgort = iv_lgort.

    ev_safety_stock = lv_min_stock.

    " Evaluate threshold
    IF ev_current_stock <= lv_min_stock.
      rv_is_critical = abap_true.
    ELSE.
      rv_is_critical = abap_false.
    ENDIF.

  ENDMETHOD.


  METHOD trigger_replenishment.
    DATA: ls_requisition TYPE banfn.

    " Simulating creation of standard Purchase Requisition in SAP
    " Typically, this would call BAPI_PR_CREATE or trigger a Workflow.
    " Here we simulate generation of a PR Document number.
    
    " Generate a random-like 10-digit PR document number starting with '900'
    " In a real SAP system, this is fetched from number range interval (Object BANF)
    CALL FUNCTION 'NUMBER_GET_NEXT'
      EXPORTING
        nr_range_nr             = '01'
        object                  = 'REQUISITION'
      IMPORTING
        number                  = rv_banfn
      EXCEPTIONS
        interval_not_found      = 1
        number_range_not_intern = 2
        object_not_found        = 3
        quantity_is_not_1       = 4
        interval_overflow       = 5
        buffer_overflow         = 6
        OTHERS                  = 7.
        
    IF sy-subrc <> 0.
      " Mock Fallback number for portfolio purposes
      rv_banfn = '9000000001'.
    ENDIF.

    " Post a workflow trigger or event link here
    " SWE_EVENT_CREATE to trigger standard replenishment workflow
    
  ENDMETHOD.
ENDCLASS.
