/* DON HUNT boards - site settings.
   sheetId: the long ID from your Google Sheet's web address
   (docs.google.com/spreadsheets/d/THIS_PART/edit). You can also paste the whole link.
   Any board link can use a different sheet by adding ?sheet=SHEET_ID to the end. */
window.DONHUNT_CONFIG = {
  sheetId: "1YWSfMr9ftFPeGsUXoclpPvsU_0MdxABGt61lfP-ndqU",
  pollSeconds: 4,      // how often the boards check the sheet
  // Google Apps Script web app that holds the PSA token and returns slab photos (see apps-script/PsaProxy.gs)
  psaProxy: "",
  brand: "DON HUNT"
};
