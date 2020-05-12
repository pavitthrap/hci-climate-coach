import json 
import requests 
api_key = 'AIzaSyBWTRG1IogLfBoqOd5DYdlWbBr5ctvkTJo'
url = ('https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze' +    
    '?key=' + api_key)
data_dict = {
    'comment': {'text': ''' Problem I see people having the exact same issues ranging months back without anyone stepping in and providing a solution.  People jumping in to Shopify theme development will end up using Slate as it's referred everywhere and spend countless hours with the same issues. Write in the very top of the main readme that assets url for images is broken and you will not provide a solution. Or simply fix this issue. This is such a disaster, really. You are wasting the time of the people are suppose to make life easier for 
 '''},
    'languages': ['en'],
    'requestedAttributes': {'TOXICITY': {}}
}
response = requests.post(url=url, data=json.dumps(data_dict)) 
response_dict = json.loads(response.content) 
print(json.dumps(response_dict, indent=2))