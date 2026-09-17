/* DON HUNT boards - site settings.
   sheetId: the long ID from your Google Sheet's web address
   (docs.google.com/spreadsheets/d/THIS_PART/edit). You can also paste the whole link.
   Any board link can use a different sheet by adding ?sheet=SHEET_ID to the end. */
window.DONHUNT_CONFIG = {
  sheetId: "1YWSfMr9ftFPeGsUXoclpPvsU_0MdxABGt61lfP-ndqU",
  pollSeconds: 4,      // how often the boards check the sheet
  // Google Apps Script web app that holds the PSA token and returns slab photos (see apps-script/PsaProxy.gs)
  psaProxy: "https://script.google.com/macros/s/AKfycbxNe1kc_bmZu25Sk0smGu2RzcfbCNQJqmB_lcgRPi2NwzztWqUCDyWoE28BAKzKlvQoXA/exec",
  brand: "DON HUNT",
  // Each extra game reads its own Google Sheet (filled in by the setup script)
  gameSheets: {
    rtyh: "1Xv3wviYmsqL17gR0oSnAAQxm6Qps31Xkn7BAJ1nDe7w",
    types: "1dFFYzZORz9bLl2-x-l3ODNmpbvH35fFo5lNgtYkm4-I",
    case: "1cjvGCX4eOXIGtl8QAtk7Kxc2lThXciktKBg0TT46tGM",
    hits: "1coLxML0j_kK0lMJ11T3Se-N_nvHyu5qpP4AslVgo_Ys"
  }
};
