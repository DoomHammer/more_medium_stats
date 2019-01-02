"use strict";

function appendColumn(row, number, number_round, text)
{
    const spanValue = document.createElement("span");
    spanValue.setAttribute('class', 'sortableTable-value');
    spanValue.appendChild(document.createTextNode(number));

    const spanNumber = document.createElement("span");
    spanNumber.setAttribute('class', 'sortableTable-number');
    spanNumber.appendChild(document.createTextNode(number_round));

    const spanShow = document.createElement("span");
    spanShow.setAttribute('class', 'u-sm-show');
    spanShow.appendChild(document.createElement('br'));
    spanShow.appendChild(document.createTextNode(text));
    spanNumber.appendChild(spanShow);

    const cell = document.createElement("td");
    cell.appendChild(spanValue);
    cell.appendChild(spanNumber);

    row.appendChild(cell);
}

function appendHeaders(row, text)
{
    const buttonText = document.createElement("button");
    buttonText.appendChild(document.createTextNode(text));

    const cell = document.createElement("th");
    cell.setAttribute('class', 'sortableTable-header');
    cell.appendChild(buttonText);

    row.appendChild(cell);
}

function stripMediumJson(text) {
  const json = text.substring('])}while(1);</x>'.length);
  return JSON.parse(json);
}

function getClapsCount(clapsUrl) {
  const paginationLoop = async() => {
    let interactions = [];
    let paginate = true;
    let pageSize = 10;
    let pageNumber = 0;

    while (paginate !== false) {
      const request = async() => {
        const response = await fetch(clapsUrl, {
          mode: 'no-cors'
        });
        const text = await response.text();
        const json = await stripMediumJson(text);
        const payload = await json['payload'];
        const usersWithClaps = await payload['value']['usersWithClapCounts'];
        const totalRecordCount = await payload['value']['count']
        debugger;
        if ((pageNumber + 1) * pageSize > totalRecordCount) {
          paginate = false;
        } else {
          pageNumber++;
          clapsUrl = clapsUrl.split("?")[0] + '?limit=' + pageSize + '&pageNumber=' + pageNumber;
        }
        return await usersWithClaps;
      };
      Array.prototype.push.apply(interactions, await request());
    }
    return interactions;
  };
  return paginationLoop();
}

function getResponsesCount(responsesUrl) {
  const paginationLoop = async() => {
    let numberOfComments = 0;
    let paginate = true;

    while (paginate !== false) {
      const request = async() => {
        const response = await fetch(responsesUrl, {
          mode: 'no-cors'
        });
        const text = await response.text();
        const json = await stripMediumJson(text);
        const payload = await json['payload'];
        const paging = await payload['paging'];
        if (await paging.hasOwnProperty('next')) {
          const next = await paging['next'];
          responsesUrl = responsesUrl.split("?")[0] + '?limit=' + await next['limit'] + '&to=' + await next['to'];
        } else {
          paginate = false;
        }
        return await payload['value'].length;
      };
      numberOfComments += await request();
    }
    return numberOfComments;
  };
  return paginationLoop();
}

function getClaps(row, postId, fans) {
  const clapsUrl = 'https://medium.com/p/' + postId + '/upvotes?limit=10';
  const processClaps = async() => {
    let numberOfClaps = 0;
    let standingOvations = 0;
    const interactions = await getClapsCount(clapsUrl);
    debugger;
    for (let i = 0; i < await interactions.length; i++) {
      let clapCount = parseInt(await interactions[i]['clapCount']);
      numberOfClaps += await clapCount;
      if (await clapCount == 50) {
        standingOvations += 1;
      }
    }
    let claps_per_fan = 0;
    let standingOvations_per_fan = 0
    if (fans > 0) {
      claps_per_fan = await numberOfClaps / fans;
      standingOvations_per_fan = standingOvations / fans;
    }
    const claps_per_fan_round = Math.round(await claps_per_fan);
    const standingOvations_per_fan_round = Math.round(standingOvations_per_fan);
    appendColumn(row, await numberOfClaps, await numberOfClaps, 'Claps');
    appendColumn(row, await claps_per_fan, await claps_per_fan_round, 'Claps per fan');
    appendColumn(row, standingOvations, standingOvations, 'Standing ovations');
    appendColumn(row, standingOvations_per_fan, standingOvations_per_fan_round, 'Standing ovations per fan');
  }
  processClaps();
}

function getResponses(row, postId, views) {
  const responsesUrl = 'https://medium.com/_/api/posts/' + postId + '/responses?limit=10';
  const processResponses = async() => {
    const responseCount = await getResponsesCount(responsesUrl);
    const comment_ratio = await responseCount / (views / 1000);
    const comment_ratio_round = Math.round(await comment_ratio);
    appendColumn(row, await comment_ratio, await comment_ratio_round, 'Comments per 1000 views');
  };
  processResponses();
}

function makeGatherArticleData(row, postId, views, fans) {
  return function() {
    getClaps(row, postId, fans);
    getResponses(row, postId, views);
  };
}

const header_row_element = document.getElementsByClassName('sortableTableHeaders')[0].getElementsByTagName('tr')[0];

["Fan ratio", "Claps", "Claps per fan", "Standing ovations", "Standing ovations per fan", "Comments per 1000 views"]
    .forEach(x => appendHeaders(header_row_element, x))

Array.from(document.getElementsByClassName('js-statsTableBody')).forEach(
  item => {
    var rows = item.getElementsByClassName('js-statsTableRow');
    Array.from(rows).forEach(
      function(row) {
        var tds = row.getElementsByTagName("td");
        var postId = row.getAttribute('data-action-value');
        var views = tds[1].getElementsByClassName('sortableTable-number')[0].getAttribute('title').replace(/,/g, '');
        var read = tds[2].getElementsByClassName('sortableTable-number')[0].getAttribute('title').replace(/,/g, '');
        var fans = tds[4].getElementsByClassName('sortableTable-number')[0].getAttribute('title');
        /*
        2- Fan Rate
        The fan rate is obtained by dividing the number of people who have clapped (called Fans) by the number of reads. For me this is a reliable measure of actual engagement. Views, reads and claps are nothing but vanity metrics alone.
        The Fan Rate is tracking how many people who presumably read the article actually cared to clap for it.
        */
        var fan_ratio = fans / read * 100;
        var fan_ratio_round = Math.round(fan_ratio);
        appendColumn(row, fan_ratio, fan_ratio_round + '%', 'fan ratio');
        /*
        3- Comments Per 1000 Views
        It’s fine if people read or clap for your work, but real engagement is not a signal. But actual highlights (points they agree with or find most salient) and comments are. They signal that your audience was emotionally engaged in the topic, regardless of the slant of the comment. We are people, real interaction does matter.
        If an article does not receive any comments it’s not emotionally impactful, authentic or does not present the material in a relatable manner.
        In practice counting highlights doesn’t make much sense, but tabulating the number of comments per 1,000 views makes sense.
        */
        let gatherArticleData = makeGatherArticleData(row, postId, views, fans);
        gatherArticleData();
        /*
        4- Average Claps per Fan
        Audiences on Medium mostly clap one time like a like, but they can choose to applaud an article up to 50 times, called a standing ovation. While this clap feature is very hackable, I still think it can be relevant if the sample size of views and fans is large enough, and Medium’s algorithm certainly understands it rather well. As such, it’s helpful as a writer to keep track of it.
        A general baseline is for an article to average more than 10 claps per fan. While the majority of people might only clap once, you want enough people to clap over 20 times to counter-balance this.
        */

        /*
        5- Standing Ovations to Fans Ratio
        So assuming your article isn’t an article boosted by fake traffic (i.e. an airdrop), getting standing ovations (that consist of 50 claps) will be relatively rare. However if an article truly resonates with people, you will notice multiple standing ovations. By simply counting them, and dividing that by the number of total people who clapped (fans), you can get a reliable impact on the high-octane merits of your article.
        */
      }
    );
  }
);