CLASS zcl_im_inv_repl_badi DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.

    INTERFACES if_ex_mb_document_badi .
  PROTECTED SECTION.
  PRIVATE SECTION.
ENDCLASS.



CLASS zcl_im_inv_repl_badi IMPLEMENTATION.


  METHOD if_ex_mb_document_badi~mb_document_before_update.
    DATA: lv_is_critical   TYPE abap_bool,
          lv_current_stock TYPE labst,
          lv_safety_stock  TYPE labst,
          lv_reorder_qty   TYPE labst,
          lv_banfn         TYPE banfn,
          ls_move          TYPE zminvent_move.

    " XMSEG contains the items of the material document currently being posted
    LOOP AT xmseg ASSIGNING FIELD-SYMBOL(<fs_mseg>).

      " Check if it is a relevant goods movement type (e.g., Goods Issues: 201, 261, 601)
      " Or any movement that reduces inventory.
      " Debit/Credit Indicator (SHKZG): 'H' is Goods Issue (reduction), 'S' is Goods Receipt (addition)
      IF <fs_mseg>-shkzg = 'H'.

        " 1. Log the movement to our custom tracking table ZMINVENT_MOVE
        " (In a real SAP system, this custom table logging happens here to track historical deltas)
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

        " 2. Check safety stock threshold using the OO class
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

        " 3. If safety stock limit is breached, trigger replenishment
        IF lv_is_critical = abap_true.

          " Read reorder quantity from Master Table
          SELECT SINGLE reorder_qty FROM zminvent_master
            INTO lv_reorder_qty
            WHERE matnr = <fs_mseg>-matnr
              AND werks = <fs_mseg>-werks
              AND lgort = <fs_mseg>-lgort.

          IF lv_reorder_qty > 0.
            " Trigger purchase requisition replenishment workflow
            lv_banfn = zcl_inventory_balance=>trigger_replenishment(
              iv_matnr   = <fs_mseg>-matnr
              iv_werks   = <fs_mseg>-werks
              iv_lgort   = <fs_mseg>-lgort
              iv_req_qty = lv_reorder_qty
            ).

            " Log replenishment action or trigger event for Business Workflow (BOR object or Class-based event)
            " Example of SAP Workflow event trigger:
            " CALL FUNCTION 'SWE_EVENT_CREATE'
            "   EXPORTING
            "     objtype           = 'BUS2009' " Purchase Requisition
            "     objkey            = conv sweinstkey( lv_banfn )
            "     event             = 'CREATED'
            "   EXCEPTIONS
            "     objtype_not_found = 1
            "     others            = 2.
          ENDIF.

        ENDIF.

      ENDIF.

    ENDLOOP.

  ENDMETHOD.


  METHOD if_ex_mb_document_badi~mb_document_update.
    " Note: This method is required by the interface but replenishment
    " validation needs to run prior to database commit (in before_update).
  ENDMETHOD.
ENDCLASS.
