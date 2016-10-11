function globalScript() {
    
    /* This script takes all the search terms which have had more than 2 conversions in the last 30 days and adds them in exact match in the relevant exact match ad group.
    
    You will need to create a new Google Sheet and name one tab "Search Terms" and one tab "Exact Match KWs".
    
    Please don't change any variables in this script, but instead update the following from within AdWords:
    
    spreadsheet_id = "insert spreadsheet id here"
    email_address = "insert email address here"
    
    */
    
    this.main = function () {
	Logger.log("for the lols");
  
  // Export search term report and keyword performance report (exact match only)
  
  var spreadsheet = SpreadsheetApp.openById(kwspreadsheet_id);
  var searchTermSheet = spreadsheet.getSheetByName("Search Terms");
  var exactMatchSheet = spreadsheet.getSheetByName("Exact Match KWs");
  searchTermSheet.clear();
  exactMatchSheet.clear();
  
  var searchTermReport = AdWordsApp.report("SELECT Query, AdGroupName, CampaignName, FinalUrl, AverageCpc FROM SEARCH_QUERY_PERFORMANCE_REPORT WHERE QueryMatchTypeWithVariant != EXACT AND ConvertedClicks >= 2 DURING LAST_30_DAYS");
  searchTermReport.exportToSheet(searchTermSheet);
  
  var exactMatchReport = AdWordsApp.report("SELECT Criteria, AdGroupName, CampaignName FROM KEYWORDS_PERFORMANCE_REPORT WHERE KeywordMatchType = EXACT AND Status = ENABLED AND AdGroupStatus = ENABLED AND CampaignStatus = ENABLED AND SystemServingStatus != RARELY_SERVED");
  exactMatchReport.exportToSheet(exactMatchSheet);
  
  // See if correct label is present
  var labelName = "Added by KW Exp Script";
  var labelSelector = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();
  
  if (!labelSelector.hasNext())
  {
      AdWordsApp.createLabel(labelName);
  }
  
  /* var labelWorked = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get().hasNext();
  Logger.log(labelWorked); */
  
  // Find the end of the exact match keyword report
  
  var lastRow = exactMatchSheet.getLastRow();
  
  // Load the keywords into an array
  
  var exactMatchKwArray = exactMatchSheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var exactLength = exactMatchKwArray.length;
  var exactMatchKws = [];
  for (var i = 0; i < exactLength; i++)
  {
    exactMatchKws[i] = (exactMatchKwArray[i][0]).toLowerCase();
  }
  
  // Sort the keywords in the array
  var lastKeyword = exactMatchKws.length;
  
  for (var j = 0; j < lastKeyword; j++)
  {
    var min = j;
    for (var k = j + 1; k < lastKeyword; k++)
    {
      if (exactMatchKws[k] < exactMatchKws[min])
      {
        min = k;
      }
      if (exactMatchKws[min] != exactMatchKws[j])
      {
        var tmp = exactMatchKws[min];
        exactMatchKws[min] = exactMatchKws[j];
        exactMatchKws[j] = tmp;

      }
    }
    
  }
  
  // See if each search query is present in the exact match list
  
  var lastSearchTerm = searchTermSheet.getLastRow();
  
  var emailKeywordsSuccess = "";
  var emailKeywordsProblem = "";
  var emailKeywordsHeadTerm = "";
  
  for (var a = 0; a < lastSearchTerm - 1; a++)
  {
  
    var searchTermStats = searchTermSheet.getRange(a + 2, 1, 1, 5).getValues();
    Logger.log(searchTermStats);    var searchTerm = (searchTermStats[0][0]).toLowerCase();
    var keywordExists = findKeyword(lastRow, exactMatchKws, searchTerm);
  
    // If search term is not found in exact match variant, get the ad group & campaign name it should be added to, make sure they exist
    
    if (keywordExists === false)
    {
      var oldAdGroup = searchTermStats[0][1];
      var oldCampaign = searchTermStats[0][2];
      var newAdGroup = "";
      var newCampaign = "";
      
      if (oldAdGroup.search("  ") != -1 || (oldAdGroup.toLowerCase()).search("head term") != -1 || (oldAdGroup.toLowerCase()).search("brand") != -1 || (oldAdGroup.toLowerCase()).search("1 - ") != -1)
      {
          emailKeywordsHeadTerm += "<tr><td>" + searchTerm + "</td><td>" + oldCampaign + "</td><td>" + oldAdGroup + "</td><td>Search Query from Head Term - please review</td></tr>";
      }
      else
      {
        if (oldAdGroup.slice(-2) === "BM")
        {
            newAdGroup = oldAdGroup.replace(" - BM", " - EX");
        }
        else if (oldAdGroup.slice(-2) === "MM")
        {
            newAdGroup = oldAdGroup;
        }
        else
        {
            newAdGroup = oldAdGroup;
        }
      
        if (oldCampaign.slice(-2) === "BM")
        {
            newCampaign = oldCampaign.replace(" - BM", " - EX");
        }
        else if (oldCampaign.slice(-2) === "MM")
        {
            newCampaign = oldCampaign;
        }
        else
        {
            newCampaign = oldCampaign;
        }

        var newCampaignExists = false;
        var newAdGroupExists = false;
      
        var findCampaign = "";
        var findAdGroup = "";
      
        if (AdWordsApp.campaigns().withCondition("CampaignName = '" + newCampaign + "'").get().totalNumEntities() === 1)
        {
            findCampaign = AdWordsApp.campaigns().withCondition("CampaignName = '" + newCampaign + "'").get().next();
            newCampaignExists = true;
        
            if (AdWordsApp.adGroups().withCondition("AdGroupName = '" + newAdGroup + "'").get().totalNumEntities() === 1)
            {
                findAdGroup = AdWordsApp.adGroups().withCondition("AdGroupName = '" + newAdGroup + "'").get().next();
                newAdGroupExists = true;
          
                // add in keywords using keyword builder, remember to include bid and Final URL
                var newCpc = (parseFloat(searchTermStats[0][4]).toFixed(2)) * 1.10;
                var newFinalUrl = searchTermStats[0][3];
                var addKeyword = findAdGroup.newKeywordBuilder().withText("[" + searchTerm + "]").withCpc(newCpc).withFinalUrl(newFinalUrl).build();
                addKeyword.getResult().applyLabel(labelName);
                kwsLabelled++;
          
                emailKeywordsSuccess = emailKeywordsSuccess + "<tr><td>" + searchTerm + "</td><td>" + newCampaign + "</td><td>" + newAdGroup + "</td><td>Successfully Added</td><td>" + newCpc + "</td></tr>";
                // searchTermSheet.getRange(a + 2, 6).setValue("" + newCpc + "");
                // searchTermSheet.getRange(a + 2, 7).setValue("" + findAdGroup + "");
            }
        }
      
        if (newCampaignExists === false)
        {
            emailKeywordsProblem += "<tr><td>" + searchTerm + "</td><td>" + newCampaign + "</td><td>N/A</td><td>New Campaign Does Not Exist</td></tr>";
        }
        else if (newCampaignExists === true && newAdGroupExists === false)
        {
            emailKeywordsProblem += "<tr><td>" + searchTerm + "</td><td>" + newCampaign + "</td><td>" + newAdGroup + "</td><td>New Ad Group Does Not Exist</td></tr>";
        }     
      
      }
    }
    
  }
  
  if (postToEmail) {
  var emailBody = "<table width = 100%><tr><td><strong>Search Term</strong></td><td><strong>New Campaign</strong></td><td><strong>New Ad Group</strong></td><td><strong>Status</strong></td><td><strong>New CPC</strong></td></tr>" + emailKeywordsSuccess + emailKeywordsProblem + emailKeywordsHeadTerm + "</table>";
  MailApp.sendEmail({
    to: email_address,
    subject: AdWordsApp.currentAccount().getName() + " High Converters -> Exact Match Report",
    htmlBody: emailBody });
    Logger.log("email sent");
  }
  
 
  if (postToSlack) {
    
   var slack = new SlackAPI({
       webhookUrl : "https://hooks.slack.com/services/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"
   });
   
   var usernames = "AdWordsBot";
   slack.sendMessage ({
       channel: slackchannel,
       username: usernames,
       text: "High converting search terms added for " + slackaccountname,
       icon_emoji: "penguin"
   });
   
   
   
}
           
};

function findKeyword (lastRow, exactMatchKws, searchTerm) {
    
    var m = 0;
    var mid = 0;
    while (lastRow >= 0 && m < lastRow)
    {
      mid = Math.floor((m + lastRow)/2);
      if (exactMatchKws[mid][0] === searchTerm)
      {
        return true;
      }
      else if (exactMatchKws[mid][0] < searchTerm)
      {
        m = mid + 1;
      }
      else if (exactMatchKws[mid][0] > searchTerm)
      {
        lastRow = mid;
      }
    }
    
    return false;
}

// SLACK INTEGRATION FUNCTIONS

function SlackAPI(config) {
  this.webhookUrl = config.webhookUrl;

  // Send a message to slack. The config can 
  // be as simple as a string or an object
  // for passing more complex messages.
this.sendMessage = function(config) {
 if (typeof config == 'object') {
   config['link_names'] = 1;
   postToSlack(this.webhookUrl, config);
 } else {
   postToSlack(this.webhookUrl, { text : config, link_names: 1 });
 }
};
  
  // Take care of all the messy stuff like
  // retries and status codes.
  function postToSlack(url, payload) {
    var options = {
      method: 'POST',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    var retries = 3;
    while(retries > 0) {
      try {
        var resp = UrlFetchApp.fetch(url,options);
        if(resp.getResponseCode() == 200) {
          return true;
        } else {
          Logger.log(
            Utilities.formatString(
              "WARNING: Slack returned status code of %s and a message of: %s",
              resp.getResponseCode(),
              resp.getContentText()
            )
          );
          Logger.log('Waiting 1 seconds then retrying...');
          Utilities.sleep(1000);
          retries--;
        }
      } catch(e) {
        Logger.log("ERROR: Something failed in UrlFetchApp. Retrying in 1 second...");
        Utilities.sleep(1000);
        retries--;
      }
    }
    throw "Either UrlFetchApp is broken or the Slack Webhook is not configured properly.";
  }
  
}
}