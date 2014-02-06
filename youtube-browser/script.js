$(function() {
  
  $.cookie.json = true;

  var g_vid_yt_user;
  var g_vid_date;

  var g_vid_offset = 1;
  var g_vid_perpage = 25;

  var g_dateVideoGroupTemplate = $('#video-date-group-template').html();
  var g_videoItemTemplate = $('#video-item-template').html();

  var g_filterFunc = function(duration, likes) {
    if (duration < 15 && likes < parseInt($('#short-video-threshold').val(), 10)) return true;
    if (duration >= 15 && likes < parseInt($('#long-video-threshold').val(), 10)) return true;
    return false;
  };

  var g_savedUsers = {
    get: function(userName) {
      var users = $.cookie('users') || [];
      for (var i = 0; i < users.length; i++) {
        if (users[i].name == userName) {
          return users[i];
        }
      }
      return null;
    },

    update: function(userInfo) {
      var users = $.cookie('users') || [];
      var found = false;
      for (var i = 0; i < users.length; i++) {
        if (users[i].name == userInfo.name) {
          users[i] = userInfo;
          found = true;
        }
      }
      if (!found) {
        users.push(userInfo);
      }
      $.cookie('users', users);
    },
    
    remove: function(userName) {
      var users = $.cookie('users') || [];
      for (var i = 0; i < users.length; i++) {
        if (users[i].name == userName) {
          users.splice(i, 1);
          break;
        }
      }
      $.cookie('users', users);
    },
    
    display: function() {
      var users = $.cookie('users') || [];
      var list = $('.yt-user-tag-list');
      list.empty();
      users.forEach(function(user) {
        var loadFunc = function() { loadVideos(user); };
        var closeFunc = function() { g_savedUsers.remove(user.name); g_savedUsers.display(); };

        var item = tag('li', {'class': 'yt-user-tag'});
        item.append(tag('a', {'class': 'value', href: '#', text: user.name, click: loadFunc}));
        item.append(tag('a', {'class': 'close', href: '#', text: 'x', click: closeFunc}));
        list.append(item);
      });
    }
  };


  function tag(name, attrs){
    return $("<" + name + ">", attrs);
  }

  function sum(a) { 
    return Array.prototype.reduce.call(a, function(pv, cv) { return pv + cv; }, 0);
  }
    
  function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  function foldVideoItem(it) {
    $('.video-thumbnail', it).hide();
    $('.video-description', it).hide();
    $('.expand-tag', it).show();
  }

  function expandVideoItem(it) {
    $('.video-thumbnail', it).show();
    $('.video-description', it).show();
    $('.expand-tag', it).hide();
  }

  function applyFilter(filterFunc, context) {
    if (!context) {
      context = $('.video-item');
    }
    context.each(function(i, it) {
      var duration = $('.video-meta-duration', it).text();
      duration = sum(duration.split().map(function(v) {
        var result = parseInt(v, 10);
        if (v.indexOf('h') >= 0) {
          result *= 60;
        }
        return result;
      }));

      var likes = $('.video-meta-likes', it).text();
      if (likes != '') {
        likes = likes.replace('[+]', '');
        likes = parseInt(likes, 10);
      }

      var dislikes = $('.video-meta-dislikes', it).text();
      if (dislikes != '') {
        dislikes = dislikes.replace('[-]', '');
        dislikes = parseInt(dislikes, 10);
      }

      var views = parseInt($('.video-meta-views', it).text(), 10);
      var comments = parseInt($('.video-meta-comments', it).text(), 10);
      var favorites = parseInt($('.video-meta-favorites', it).text(), 10);

      //console.log(duration+' '+ likes+' '+ dislikes+' '+ views+' '+ comments+' '+ favorites);

      if (filterFunc && filterFunc(duration, likes, dislikes, views, comments, favorites)) {
        foldVideoItem(it);
      } else {
        expandVideoItem(it);
      }
    });
  }

  function loadVideoStats(video_id, t) {
    var url = 'https://gdata.youtube.com/feeds/api/videos/' + video_id + '?v=2&alt=json';

    $.ajax({url: url, dataType: "json"}).done(function(data) {
      var e = data.entry;
      
      var stats = {
        views: e.yt$statistics.viewCount,
        favorites: e.yt$statistics.favoriteCount,
        comments: (e.gd$comments ? e.gd$comments.gd$feedLink.countHint : ''),
        likes: (e.yt$rating ? e.yt$rating.numLikes : ''),
        dislikes: (e.yt$rating ? e.yt$rating.numDislikes : '')
      };

      var likes = stats.likes;
      var dislikes = stats.dislikes;

      if (likes != '' && likes != '0') {
        likes = '+' + likes;
      }
      if (dislikes != '' && dislikes != '0') {
        dislikes = '-' + dislikes;
      }

      var ul = $('.video-meta ul', t);
      ul.append(tag('li', {'class': 'video-meta-likes', title: 'Likes', text: likes}));
      ul.append(tag('li', {'class': 'video-meta-dislikes', title: 'Dislikes', text: dislikes}));

      applyFilter(g_filterFunc, t);
    });
  }

  function appendVideos(video_infos) {
    video_infos.forEach(function(vi) {
      var lastGroup = $('.video-date-group:last-child');
      var lastDate = $('.date', lastGroup).text();

      if (lastDate != vi.published) {
        var t = $(Mustache.render(g_dateVideoGroupTemplate, {date: vi.published}));

        $('.date', t).click(function() {
          $(this).next().toggle(); // toggle '.videos'
        });

        t.appendTo('.video-entries');
      }

      var view = $.extend({}, vi);

      var duration = '';
      var dur = parseInt(view.duration, 10);
      if (dur > 3600) {
        duration += Math.ceil(dur/3600) + 'h ';
      }
      duration += Math.ceil(dur%3600/60) + 'm ';
      view.duration = duration;

      var t = $(Mustache.render(g_videoItemTemplate, view));

      $('.expand-tag', t).click(function() {
        expandVideoItem(t);
      });

      loadVideoStats(vi.video_id, t);

      $('.videos', lastGroup).show().append(t);
    });
  }

  function loadVideos(userInfo) {
    $('.video-entries').empty();
    
    if (userInfo) {
      $('#yt-user-selection-box').val(userInfo.name);
      $('#short-video-threshold').val(userInfo.shortThreshold);
      $('#long-video-threshold').val(userInfo.longThreshold);
    } else {
      var user = $('#yt-user-selection-box').val();
      var shortThreshold = $('#short-video-threshold').val();
      var longThreshold = $('#long-video-threshold').val();
      userInfo = {'name': user, 'shortThreshold': shortThreshold, 'longThreshold': longThreshold};
    }

    g_vid_yt_user = userInfo;
    g_vid_date = null;

    g_vid_offset = 1;
    g_vid_perpage = 50;

    loadMoreVideos();
  }

  function loadMoreVideos() {
    var url = 'https://gdata.youtube.com/feeds/api/users/' + g_vid_yt_user.name
      + '/uploads?alt=json&start-index=' + g_vid_offset + '&max-results=' + g_vid_perpage;

    $.ajax({url: url, dataType: "json"}).done(function(data) {
      var video_infos = data.feed.entry.map(function(e) {
        var vid = e.id.$t;

        return {
          video_id: vid.substring(vid.lastIndexOf('/') + 1), 
          published: e.published.$t.substring(0, 10), 
          title: e.media$group.media$title.$t, 
          description: e.media$group.media$description.$t, 
          comments: (e.gd$comments ? e.gd$comments.gd$feedLink.countHint : ''),
          url: e.media$group.media$content[0].url,
          duration: e.media$group.media$content[0].duration,
          thumbnail: e.media$group.media$thumbnail[0].url
        };
      });

      appendVideos(video_infos);

      g_savedUsers.update(g_vid_yt_user);
      g_savedUsers.display();

      $('.load-more-wrapper').show();

      g_vid_offset += g_vid_perpage;
    });
  }

  var ytUser = getParameterByName('user');
  $('#yt-user-selection-box').val(ytUser);

  $("#yt-user-selection-box").keypress(function(event) {
    if (event.which == 13) {
      event.preventDefault();
      $("#load-videos").click();
    }
  });

  var shortThreshold = getParameterByName('short-threshold');
  var longThreshold = getParameterByName('long-threshold');
  $('#short-video-threshold').val(shortThreshold);
  $('#long-video-threshold').val(longThreshold);

  $('#short-video-threshold, #long-video-threshold')
  .keypress(function(event) {
    if (event.which == 13) {
      event.preventDefault();
      applyFilter(g_filterFunc);
    }
  })
  .blur(function() {
    applyFilter(g_filterFunc);
  });

  g_savedUsers.update({'name': 'HromadskeTV', 'shortThreshold': '', 'longThreshold': ''});
  g_savedUsers.update({'name': '5channel', 'shortThreshold': '', 'longThreshold': ''});
  g_savedUsers.update({'name': 'tvzikua', 'shortThreshold': '', 'longThreshold': ''});
  g_savedUsers.update({'name': 'RadioSvobodaOrg', 'shortThreshold': '', 'longThreshold': ''});
  g_savedUsers.update({'name': 'KievForum', 'shortThreshold': '', 'longThreshold': ''});

  g_savedUsers.display();

  $('#load-videos').click(function() {
    loadVideos();
  });

  $('#load-more').click(function() {
    loadMoreVideos();
  });

});