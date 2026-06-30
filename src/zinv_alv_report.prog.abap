*&---------------------------------------------------------------------*
*& Report ZINV_ALV_REPORT
*&---------------------------------------------------------------------*
*& Description: Live Inventory Monitor & Replenishment Dashboard
*& Uses CL_SALV_TABLE (SAP Grid Control) to output material stock
*& status, and alerts for inventory dropping below safety thresholds.
*&---------------------------------------------------------------------*
REPORT zinv_alv_report.

TABLES: zminvent_master.

*----------------------------------------------------------------------*
* Selection Screen
*----------------------------------------------------------------------*
SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-001.
  SELECT-OPTIONS: s_matnr FOR zminvent_master-matnr,
                  s_werks FOR zminvent_master-werks,
                  s_lgort FOR zminvent_master-lgort.
SELECTION-SCREEN END OF BLOCK b1.

SELECTION-SCREEN BEGIN OF BLOCK b2 WITH FRAME TITLE TEXT-002.
  PARAMETERS: p_alert AS CHECKBOX DEFAULT 'X'. " Only show low-stock alerts
SELECTION-SCREEN END OF BLOCK b2.

*----------------------------------------------------------------------*
* Local Classes definition and implementation
*----------------------------------------------------------------------*
CLASS lcl_report DEFINITION.
  PUBLIC SECTION.
    TYPES: BEGIN OF ty_alv_data.
             INCLUDE TYPE zcl_inventory_balance=>ty_inventory_status.
    TYPES:   color_row TYPE lvc_t_scol, " Row/Cell coloring for ALV
           END OF ty_alv_data.

    DATA: gt_alv_data TYPE STANDARD TABLE OF ty_alv_data,
          go_salv     TYPE REF TO cl_salv_table.

    METHODS:
      get_data,
      process_data,
      display_alv,
      set_columns,
      set_handlers.

    " Event handlers for ALV click events
    METHODS:
      on_double_click FOR EVENT double_click OF cl_salv_events_table
        IMPORTING row column,
      on_user_command FOR EVENT added_function OF cl_salv_events_table
        IMPORTING e_salv_function.
ENDCLASS.

CLASS lcl_report IMPLEMENTATION.

  METHOD get_data.
    " Retrieve master inventory records
    SELECT * FROM zminvent_master
      INTO CORRESPONDING FIELDS OF TABLE gt_alv_data
      WHERE matnr IN s_matnr
        AND werks IN s_werks
        AND lgort IN s_lgort.
  ENDMETHOD.

  METHOD process_data.
    DATA: lv_is_critical   TYPE abap_bool,
          lv_current_stock TYPE labst,
          lv_safety_stock  TYPE labst,
          ls_color         TYPE lvc_s_scol,
          lt_colors        TYPE lvc_t_scol.

    FIELD-SYMBOLS: <fs_data> TYPE ty_alv_data.

    LOOP AT gt_alv_data ASSIGNING <fs_data>.
      CLEAR: lv_is_critical, lv_current_stock, lv_safety_stock, lt_colors.

      " Calculate realtime balance and evaluate against safety stock
      lv_is_critical = zcl_inventory_balance=>check_safety_threshold(
        EXPORTING
          iv_matnr       = <fs_data>-matnr
          iv_werks       = <fs_data>-werks
          iv_lgort       = <fs_data>-lgort
        IMPORTING
          ev_current_stock = lv_current_stock
          ev_safety_stock  = lv_safety_stock
      ).

      <fs_data>-labst = lv_current_stock.

      " Define reporting alerts and colors
      IF lv_is_critical = abap_true.
        <fs_data>-status_icon = '@0A@'. " Red LED Icon in SAP GUI
        <fs_data>-msg         = 'CRITICAL: Below Safety Stock Threshold!'.

        " Apply red color to row in ALV Grid (Color Code: Red = 6)
        ls_color-fname = ''.
        ls_color-color-col = 6. " Red
        ls_color-color-int = 1. " Intensified
        ls_color-color-inv = 0.
        APPEND ls_color TO lt_colors.
        <fs_data>-color_row = lt_colors.

      ELSE.
        <fs_data>-status_icon = '@08@'. " Green LED Icon in SAP GUI
        <fs_data>-msg         = 'Stock Normal.'.
      ENDIF.

      " Filtering low-stock alerts if checkmark is checked on selection screen
      IF p_alert = abap_true AND lv_is_critical = abap_false.
        DELETE gt_alv_data.
        CONTINUE.
      ENDIF.

    ENDLOOP.
  ENDMETHOD.

  METHOD display_alv.
    DATA: lx_msg TYPE REF TO cx_salv_msg.

    TRY.
        cl_salv_table=>factory(
          IMPORTING
            r_salv_table = go_salv
          CHANGING
            t_table      = gt_alv_data
        ).

        " Enable standard ALV toolbar functions (Filter, Sort, Export, etc.)
        go_salv->get_functions( )->set_all( abap_true ).

        " Customize columns settings
        set_columns( ).

        " Set event handlers
        set_handlers( ).

        " Display Grid
        go_salv->display( ).

      CATCH cx_salv_msg INTO lx_msg.
        MESSAGE lx_msg TYPE 'E'.
    ENDTRY.
  ENDMETHOD.

  METHOD set_columns.
    DATA: lo_cols TYPE REF TO cl_salv_columns_table,
          lo_col  TYPE REF TO cl_salv_column_table.

    lo_cols = go_salv->get_columns( ).
    lo_cols->set_optimize( abap_true ).

    " Set row coloring column
    TRY.
        lo_cols->set_color_column( 'COLOR_ROW' ).
      CATCH cx_salv_data_error.
    ENDTRY.

    " Optimize technical / technical-looking column headers
    TRY.
        lo_col ?= lo_cols->get_column( 'STATUS_ICON' ).
        lo_col->set_long_text( 'Alert Status' ).
        lo_col->set_medium_text( 'Alert Status' ).
        lo_col->set_short_text( 'Alert' ).
        lo_col->set_alignment( if_salv_c_alignment=>centered ).
      CATCH cx_salv_not_found.
    ENDTRY.

    TRY.
        lo_col ?= lo_cols->get_column( 'MSG' ).
        lo_col->set_long_text( 'Status Details' ).
        lo_col->set_medium_text( 'Details' ).
      CATCH cx_salv_not_found.
    ENDTRY.
  ENDMETHOD.

  METHOD set_handlers.
    DATA: lo_events TYPE REF TO cl_salv_events_table.

    lo_events = go_salv->get_event( ).
    SET HANDLER on_double_click FOR lo_events.
    SET HANDLER on_user_command FOR lo_events.
  ENDMETHOD.

  METHOD on_double_click.
    " Show material document detail list when double clicking a material row
    READ TABLE gt_alv_data INTO DATA(ls_row) INDEX row.
    IF sy-subrc = 0.
      SUBSUB_DRILLDOWN( ls_row-matnr ).
    ENDIF.
  ENDMETHOD.

  METHOD on_user_command.
    " Catch custom toolbar actions (e.g., triggering manual replenishment reorders)
    CASE e_salv_function.
      WHEN 'REORDER'.
        " Trigger reorders for all currently selected low-stock items in the list.
        " Simulates running bulk replenishment.
        MESSAGE 'Triggering automated replenishment for critical items...' TYPE 'I'.
    ENDCASE.
  ENDMETHOD.

ENDCLASS.

*----------------------------------------------------------------------*
* Drilldown sub-report definition
*----------------------------------------------------------------------*
FORM subsub_drilldown USING pv_matnr TYPE matnr.
  " Secondary ALV showing movement history for double-clicked material
  DATA: lt_movements TYPE STANDARD TABLE OF zminvent_move,
        lo_salv_sub  TYPE REF TO cl_salv_table,
        lx_msg_sub   TYPE REF TO cx_salv_msg.

  SELECT * FROM zminvent_move
    INTO TABLE lt_movements
    WHERE matnr = pv_matnr.

  IF lt_movements IS INITIAL.
    MESSAGE 'No movement history found for this material.' TYPE 'I'.
    RETURN.
  ENDIF.

  TRY.
      cl_salv_table=>factory(
        IMPORTING
          r_salv_table = lo_salv_sub
        CHANGING
          t_table      = lt_movements
      ).
      lo_salv_sub->get_functions( )->set_all( abap_true ).
      lo_salv_sub->get_columns( )->set_optimize( abap_true ).
      lo_salv_sub->set_screen_popup(
        start_column = 10
        end_column   = 90
        start_line   = 5
        end_line     = 20
      ).
      lo_salv_sub->display( ).
    CATCH cx_salv_msg INTO lx_msg_sub.
      MESSAGE lx_msg_sub TYPE 'E'.
  ENDTRY.
ENDFORM.

*----------------------------------------------------------------------*
* Initial Trigger
*----------------------------------------------------------------------*
START-OF-SELECTION.
  DATA(lo_report) = NEW lcl_report( ).
  lo_report->get_data( ).
  lo_report->process_data( ).
  lo_report->display_alv( ).
