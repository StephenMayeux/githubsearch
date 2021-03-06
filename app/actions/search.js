import * as types from 'types';
import { polyfill } from 'es6-promise';
import { get } from 'axios';
import moment from 'moment';

import { GITHUB_USER_NAME, GITHUB_PASSWORD, TYPING_DELAY, DEFAULT_SEARCH_ERROR_MESSAGE } from 'constants';

polyfill();

function makeGitHubSearchRequest(query) {
  return get('https://api.github.com/search/repositories', {
    params: {
      q: constructQueryString(query),
      sort: query.sort,
      order: query.order,
      page: query.page
    },
    auth: {
      username: GITHUB_USER_NAME,
      password: GITHUB_PASSWORD
    }
  });
}

function createGitHubSearchRequest() {
  return {
    type: types.GITHUB_SEARCH_REQUEST
  }
}

function createGitHubSearchSuccess() {
  return {
    type: types.GITHUB_SEARCH_SUCCESS
  }
}

function createGitHubSearchFailure(message) {
  return {
    type: types.GITHUB_SEARCH_FAILURE,
    message
  }
}

export function updateSearchField(text) {
  return {
    type: types.UPDATE_SEARCH_FIELD,
    text
  }
}

export function fetchSearchResults() {
  return (dispatch, getState) => {
    let state = getState();

    if (!state.search.searchText) {
      return dispatch(clearSearchResults());
    }

    let query = {
      text: state.search.searchText,
      filters: state.filters,
      sort: state.sorting.type,
      order: state.sorting.order,
      page: `${state.search.pagesLoaded+1}`
    }

    dispatch(createGitHubSearchRequest());
    return makeGitHubSearchRequest(query)
      .then(res => {
        console.log(res);
        if (res.status === 200) {
          dispatch(updateSearchResults(res.data.items.map((item) => {
            return {
              name: item.name,
              description: item.description,
              url: item.html_url,
              stars: item.stargazers_count,
              forks: item.forks_count,
              language: item.language,
              owner: {
                login: item.owner.login,
                url: item.owner.html_url,
                picture: item.owner.avatar_url
              },
              createdAt: item.created_at,
              latestCommit: item.pushed_at,
              openIssues: item.open_issues
            }
          })));
          dispatch(updateSearchResultsCountTotal(res.data.total_count));
          return dispatch(createGitHubSearchSuccess());
        }
        else {
          let message = `Oops, it looks like something went wrong... HTTP Status ${res.status}: ${res.statusText}`;
          return dispatch(createGitHubSearchFailure(message));
        }
      })
      .catch((res) => {
        let message = `Oops, it looks like something went wrong... HTTP Status ${res.status}: ${res.statusText}`;
        if (res.status === 403) {
          message = "It looks like you've tried to search too many times. GitHub only lets us do 30 searches per minute. Try again in a minute :)";
        }
        return dispatch(createGitHubSearchFailure(message));
      });
  }
}

export function updateSearchResults(results) {
  return {
    type: types.UPDATE_SEARCH_RESULTS,
    results
  }
}

function updateSearchResultsCountTotal(count) {
  return {
    type: types.UPDATE_SEARCH_RESULTS_COUNT_TOTAL,
    count
  }
}

export function typingInSearchField(text) {
  return (dispatch, getState) => {
    clearTimeout(getState().search.typingTimeoutID);
    dispatch(updateSearchField(text));
    return dispatch(setTypingTimeout(setTimeout(() => {
      dispatch(clearSearchResults());
      dispatch(fetchSearchResults());
    }, TYPING_DELAY)));
  }
}

function setTypingTimeout(timeoutID) {
  return {
    type: types.SET_SEARCH_FIELD_TYPING_TIMEOUT,
    timeoutID
  }
}

export function clearSearchResults() {
  return {
    type: types.CLEAR_SEARCH_RESULTS
  }
}

export function domLoaded() {
  return {
    type: types.DOM_LOADED
  }
}

function constructQueryString(query) {
  let queryString = query.text;
  if (query.filters.language) queryString += ` language:${query.filters.language}`;
  if (query.filters.author) queryString += ` user:${query.filters.author}`;
  if (query.filters.lastCommit) {
    let timeStamp = getTimestamp(query.filters.lastCommit);
    queryString += ` pushed:${timeStamp}`;
  }
  if (query.filters.repoCreated) {
    let timeStamp = getTimestamp(query.filters.repoCreated);
    queryString += ` created:${timeStamp}`;
  }
  if (query.filters.stars) {
    queryString += ` stars:>=${query.filters.stars}`;
  }
  if (query.filters.forks) {
    queryString += ` forks:>=${query.filters.forks}`;
  }
  if (query.filters.showForkedRepos) {
    queryString += ` fork:true`;
  }

  function getTimestamp(value) {
    let time = moment();
    let timeStamp = "";
    let format = "YYYY-MM-DDTHH:mm:ss+07:00";
    switch (value) {
      case "last24Hours":
        timeStamp = ">"+time.subtract(1, 'days').format(format);
        break;
      case "lastWeek":
        timeStamp = ">"+time.subtract(1, 'weeks').format(format);
        break;
      case "lastMonth":
        timeStamp = ">"+time.subtract(1, 'months').format(format);
        break;
      case "last3Months":
        timeStamp = ">"+time.subtract(3, 'months').format(format);
        break;
      case "lastYear":
        timeStamp = ">"+time.subtract(1, 'years').format(format);
        break;
      case "moreThanYear":
        timeStamp = "<"+time.subtract(1, 'years').format(format);
        break;
      default:
        timeStamp = time.format(format);
    }

    return timeStamp;
  }

  console.log(queryString);

  return queryString;
}
