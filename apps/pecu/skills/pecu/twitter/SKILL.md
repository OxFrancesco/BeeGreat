---
name: pecu-twitter
description: Read X (Twitter) through twitterapi.io. Posts, search, profiles, followers, replies, quotes, lists, communities, Spaces and trends.
tools: ["twitter_*"]
triggers: '\b(twitter|tweets?|tweeted|x posts?|posts? on x|on x\b|x account|x profile|followers|quote tweets?|retweets?|reposts?|x spaces?|x communit(y|ies)|x lists?|trending on|trends on x|what (are )?people (saying|posting))\b|(^|\s)@[A-Za-z0-9_]{2,15}\b'
---

# X data

These are read-only calls through twitterapi.io. Pecu cannot post, like, follow or send messages.

- Resolve handles first. twitter_user_info takes a username; use twitter_user_search when only a name is known.
- For a person's recent posts use twitter_user_last_tweets. For a date window or a topic use twitter_search with operators in query and dates in since and until; sort Top finds the most engaged posts.
- One page is about 20 posts and costs credits. Fetch another page only when the question needs it, and never more than three pages in one turn.
- Report what posts say with their author, time and link. Engagement counts show attention, not truth or effect. Never present a post as verified fact.
