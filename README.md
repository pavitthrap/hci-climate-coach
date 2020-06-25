# hci-climate-coach
A github action to monitor and help improve the climate of a repository. It reports statistics such as number of new contributors to a repository, number of toxic comments, and compares your repository across several stats against repositories of a specific size. 

# Usage

See [action.yml](action.yml)

```yaml
name: Climate Coach Action
  
on: [push]

jobs:
  climate_job:
    runs-on: ubuntu-latest
    name: A job that is scheduled once a month(S)
    steps:
    - name: Climate coach comment creation step
      uses: pavitthrap/hci-climate-coach@v1.0.116
      with:
        repo-token: ${{ secrets.GITHUB_TOKEN }}
        repo-name: "hci-demo"
        repo-owner: "pavitthrap"
        google-api-key: ${{ secrets.GOOGLE_API_KEY }}
        send-grid-key: ${{secrets.SEND_GRID_KEY}}
```


# Example message: 
> # May project climate report for hci-demo📊🐻⛄️🐛
> ## 🐻 Your project stats
- Number of new contributors this month: 0
- Number of unique commenters / contributors this month: 2
- Percent “toxic” comments: 0.167
- Number of “toxic” comments: 1
## 🔥 Problem convos
Here are some conversations you should probably check in on
- https://github.com/pavitthrap/hci-demo/issues/219#issuecomment-634906552
## 🐛 How you compare to other projects
For projects your size (X-Y contributors)*, you are in the….
- 5th percentile for toxic comments (min = X, max = Y, median = Z)

# Implementation Notes 
- This action is under the expectation it will be run monthly. When it is run, it collects the stats for the previous month. 
- The schedule that this action runs on depends on the "cron" line in the workflow file. Use [crontab guru](https://crontab.guru/) to help format the schedule to be what you want. 
  - '00 9 1 1-12 \*' corresponds to *at 09:00 on day-of-month 1 in every month from January through December*.
  - '[min] [hour] [day of month] [month] [day of week]' is the format for cron. 
- In order to run this action, you will need to provide a Google API key. This key is necessary to run the Google Perspective API to determine toxicity in comments. You can make a key by following the instructions [here] (https://github.com/conversationai/perspectiveapi/tree/master/1-get-started#enable-the-api). In order to pass the key to the action, you can add the key under the name GOOGLE_API_KEY as a "secret" to your repo (look under Settings> Secrets). 
