import httpx

url = "http://localhost:8000/detect"

files={'image': open('test_image.jpg','rb')}
data = {
    'lang': 'English',
    'state': 'Rajasthan',
    'crop_name': 'tomato'
}
response = httpx.post(url, files=files, data=data)
print(response.status_code)
print(response.text)

