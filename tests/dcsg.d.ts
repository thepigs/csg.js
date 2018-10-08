declare namespace CSG{
  export class Vector{
    constructor(any)
    minus(v:Vector):Vector
  }
  export class Polygon{
    vertices:Vertex[]
    constructor(v:Vertex[])
    clone():Polygon
    translate(d:Vector):Polygon
  }

  export class Vertex{
    pos:Vector
    constructor(v:Vector[],shared:any)
  }
}
export default CSG