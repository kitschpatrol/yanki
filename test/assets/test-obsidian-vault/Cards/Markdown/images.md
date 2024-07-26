# Images

---

## Internal

### Wiki style

#### Name only

![[yanki image.jpg]]

![[test image.jpg]]

![[test image.jpeg]]

![[test image.jpg|alt text]]

![[test image.jpg|200]]

![[test image.jpg|alt text|200]]

![[test image.jpg|200x50]]

![[test image.jpg|alt text|200x50]]

#### Relative path

![[../Group 1/test image.jpg]]

![[../Group 1/test image.jpg|alt text]]

![[../Group 1/test image.jpg|200]]

![[../Group 1/test image.jpg|alt text|200]]

![[../Group 1/test image.jpg|200x100]]

![[../Group 1/test image.jpg|alt text|200x100]]

![[../Group 2/test image.jpg]]

![[../Group 2/test image.jpg|alt text]]

![[../Group 2/test image.jpg|200]]

![[../Group 2/test image.jpg|alt text|200]]

![[../Group 2/test image.jpg|200x100]]

![[../Group 2/test image.jpg|alt text|200x100]]

#### Absolute path

##### Bare

![[Cards/Group 1/test image.jpg]]

![[Cards/Group 1/test image.jpg|alt text]]

![[Cards/Group 1/test image.jpg|200]]

![[Cards/Group 1/test image.jpg|alt text|200]]

![[Cards/Group 1/test image.jpg|200x100]]

![[Cards/Group 1/test image.jpg|alt text|200x100]]

![[Cards/Group 2/test image.jpg]]

![[Cards/Group 2/test image.jpg|alt text]]

![[Cards/Group 2/test image.jpg|200]]

![[Cards/Group 2/test image.jpg|alt text|200]]

![[Cards/Group 2/test image.jpg|200x100]]

![[Cards/Group 2/test image.jpg|alt text|200x100]]

##### Leading slash

![[/Cards/Group 1/test image.jpg]]

![[/Cards/Group 1/test image.jpg|alt text]]

![[/Cards/Group 1/test image.jpg|200]]

![[/Cards/Group 1/test image.jpg|alt text|200]]

![[/Cards/Group 1/test image.jpg|200x100]]

![[/Cards/Group 1/test image.jpg|alt text|200x100]]

![[/Cards/Group 2/test image.jpg]]

![[/Cards/Group 2/test image.jpg|alt text]]

![[/Cards/Group 2/test image.jpg|200]]

![[/Cards/Group 2/test image.jpg|alt text|200]]

![[/Cards/Group 2/test image.jpg|200x100]]

![[/Cards/Group 2/test image.jpg|alt text|200x100]]
  
#### Size edge cases

##### Last size wins

![[test image.jpg|10|20|30]]

##### Only last segment is parsed

![[test image.jpg|10|20x20|stuff]]

![[test image.jpg|10|20|30x100]]

### Markdown style

#### Name only

![](test%20image.jpg)

![alt text](test%20image.jpg)

![200](test%20image.jpg)

![alt text|200](test%20image.jpg)

![200x50](test%20image.jpg)

![alt text|200x50](test%20image.jpg)

![](<test image.jpg>)

![alt text](<test image.jpg>)

![200](<test image.jpg>)

![alt text|200](<test image.jpg>)

![200x50](<test image.jpg>)

![alt text|200x50](<test image.jpg>)

#### Relative path

![](../Group%201/test%20image.jpg)

![alt text](../Group%201/test%20image.jpg)

![200](../Group%201/test%20image.jpg)

![alt text|200](../Group%201/test%20image.jpg)

![200x50](../Group%201/test%20image.jpg)

![alt text|200x50](../Group%201/test%20image.jpg)

![](<../Group 1/test image.jpg>)

![alt text](<../Group 1/test image.jpg>)

![200](<../Group 1/test image.jpg>)

![alt text|200](<../Group 1/test image.jpg>)

![200x50](<../Group 1/test image.jpg>)

![alt text|200x50](<../Group 1/test image.jpg>)

#### Absolute path

##### Bare

![](Cards/Group%201/test%20image.jpg)

![alt text](Cards/Group%201/test%20image.jpg)

![200](Cards/Group%201/test%20image.jpg)

![alt text|200](Cards/Group%201/test%20image.jpg)

![200x50](Cards/Group%201/test%20image.jpg)

![alt text|200x50](Cards/Group%201/test%20image.jpg)

![](<Cards/Group 1/test image.jpg>)

![alt text](<Cards/Group 1/test image.jpg>)

![200](<Cards/Group 1/test image.jpg>)

![alt text|200](<Cards/Group 1/test image.jpg>)

![200x50](<Cards/Group 1/test image.jpg>)

![alt text|200x50](<Cards/Group 1/test image.jpg>)

##### Leading slash

![](/Cards/Group%201/test%20image.jpg)

![alt text](/Cards/Group%201/test%20image.jpg)

![200](/Cards/Group%201/test%20image.jpg)

![alt text|200](/Cards/Group%201/test%20image.jpg)

![200x50](/Cards/Group%201/test%20image.jpg)

![alt text|200x50](/Cards/Group%201/test%20image.jpg)

![](</Cards/Group 1/test image.jpg>)

![alt text](</Cards/Group 1/test image.jpg>)

![200](</Cards/Group 1/test image.jpg>)

![alt text|200](</Cards/Group 1/test image.jpg>)

![200x50](</Cards/Group 1/test image.jpg>)

![alt text|200x50](</Cards/Group 1/test image.jpg>)


## External

![](https://storage.kitschpatrol.com/example-image-1.jpeg)

![tiny](https://storage.kitschpatrol.com/example-image-1.jpeg)

![100](https://storage.kitschpatrol.com/example-image-1.jpeg)

![tiny|100](https://storage.kitschpatrol.com/example-image-1.jpeg)

![100x40](https://storage.kitschpatrol.com/example-image-1.jpeg)

![tiny|100x40](https://storage.kitschpatrol.com/example-image-1.jpeg)

#### Size edge cases

##### Last size wins

![10|20|30](https://storage.kitschpatrol.com/example-image-1.jpeg)

##### Only last segment is parsed

![10|20x20|alt stuff](https://storage.kitschpatrol.com/example-image-1.jpeg)

![10|20|30x100](https://storage.kitschpatrol.com/example-image-1.jpeg)
