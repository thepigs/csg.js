(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Constructive Solid Geometry (CSG) is a modeling technique that uses Boolean
// operations like union and intersection to combine 3D solids. This library
// implements CSG operations on meshes elegantly and concisely using BSP trees,
// and is meant to serve as an easily understandable implementation of the
// algorithm. All edge cases involving overlapping coplanar polygons in both
// solids are correctly handled.
// 
// Example usage:
// 
//     var cube = CSG.cube();
//     var sphere = CSG.sphere({ radius: 1.3 });
//     var polygons = cube.subtract(sphere).toPolygons();
// 
// ## Implementation Details
// 
// All CSG operations are implemented in terms of two functions, `clipTo()` and
// `invert()`, which remove parts of a BSP tree inside another BSP tree and swap
// solid and empty space, respectively. To find the union of `a` and `b`, we
// want to remove everything in `a` inside `b` and everything in `b` inside `a`,
// then combine polygons from `a` and `b` into one solid:
// 
//     a.clipTo(b);
//     b.clipTo(a);
//     a.build(b.allPolygons());
// 
// The only tricky part is handling overlapping coplanar polygons in both trees.
// The code above keeps both copies, but we need to keep them in one tree and
// remove them in the other tree. To remove them from `b` we can clip the
// inverse of `b` against `a`. The code for union now looks like this:
// 
//     a.clipTo(b);
//     b.clipTo(a);
//     b.invert();
//     b.clipTo(a);
//     b.invert();
//     a.build(b.allPolygons());
// 
// Subtraction and intersection naturally follow from set operations. If
// union is `A | B`, subtraction is `A - B = ~(~A | B)` and intersection is
// `A & B = ~(~A | ~B)` where `~` is the complement operator.
// 
// ## License
// 
// Copyright (c) 2011 Evan Wallace (http://madebyevan.com/), under the MIT license.

// # class CSG

// Holds a binary space partition tree representing a 3D solid. Two solids can
// be combined using the `union()`, `subtract()`, and `intersect()` methods.

CSG = function() {
  this.polygons = [];
};

// Construct a CSG solid from a list of `CSG.Polygon` instances.
CSG.fromPolygons = function(polygons) {
  var csg = new CSG();
  csg.polygons = polygons;
  return csg;
};

CSG.prototype = {
  clone: function() {
    var csg = new CSG();
    csg.polygons = this.polygons.map(function(p) { return p.clone(); });
    return csg;
  },
  toPolygons: function() {
    return this.polygons;
  },
  toStl: function(){
    var stl = "solid box\n";
    this.polygons.forEach(p=>{
      var v = p.vertices;
      for (var i = 2; i < v.length; i++) {
        stl += "facet normal "+p.plane.normal.x+' '+p.plane.normal.y+' '+p.plane.normal.z+'\n'
        stl += "outer loop\n";
  
        stl+="vertex "+v[0].pos.x+' '+v[0].pos.y+' '+v[0].pos.z+'\n';
        stl+="vertex "+v[i-1].pos.x+' '+v[i-1].pos.y+' '+v[i-1].pos.z+'\n';
        stl+="vertex "+v[i].pos.x+' '+v[i].pos.y+' '+v[i].pos.z+'\n';

        stl += "endloop\n";
        stl += "endfacet\n";

      }
      stl += "endsolid box\n";
    })
    return stl;
  },
  // Return a new CSG solid representing space in either this solid or in the
  // solid `csg`. Neither this solid nor the solid `csg` are modified.
  // 
  //     A.union(B)
  // 
  //     +-------+            +-------+
  //     |       |            |       |
  //     |   A   |            |       |
  //     |    +--+----+   =   |       +----+
  //     +----+--+    |       +----+       |
  //          |   B   |            |       |
  //          |       |            |       |
  //          +-------+            +-------+
  // 
  union: function(csg) {
    var a = new CSG.Node(this.clone().polygons);
    var b = new CSG.Node(csg.clone().polygons);
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    return CSG.fromPolygons(a.allPolygons());
  },

  // Return a new CSG solid representing space in this solid but not in the
  // solid `csg`. Neither this solid nor the solid `csg` are modified.
  // 
  //     A.subtract(B)
  // 
  //     +-------+            +-------+
  //     |       |            |       |
  //     |   A   |            |       |
  //     |    +--+----+   =   |    +--+
  //     +----+--+    |       +----+
  //          |   B   |
  //          |       |
  //          +-------+
  // 
  subtract: function(csg) {
    var a = new CSG.Node(this.clone().polygons);
    var b = new CSG.Node(csg.clone().polygons);
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  },

  // Return a new CSG solid representing space both this solid and in the
  // solid `csg`. Neither this solid nor the solid `csg` are modified.
  // 
  //     A.intersect(B)
  // 
  //     +-------+
  //     |       |
  //     |   A   |
  //     |    +--+----+   =   +--+
  //     +----+--+    |       +--+
  //          |   B   |
  //          |       |
  //          +-------+
  // 
  intersect: function(csg) {
    var a = new CSG.Node(this.clone().polygons);
    var b = new CSG.Node(csg.clone().polygons);
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  },

  // Return a new CSG solid with solid and empty space switched. This solid is
  // not modified.
  inverse: function() {
    var csg = this.clone();
    csg.polygons.map(function(p) { p.flip(); });
    return csg;
  }
};

// Construct an axis-aligned solid cuboid. Optional parameters are `center` and
// `radius`, which default to `[0, 0, 0]` and `[1, 1, 1]`. The radius can be
// specified using a single number or a list of three numbers, one for each axis.
// 
// Example code:
// 
//     var cube = CSG.cube({
//       center: [0, 0, 0],
//       radius: 1
//     });
CSG.cube = function(options) {
  options = options || {};
  var c = new CSG.Vector(options.center || [0, 0, 0]);
  var r = !options.radius ? [1, 1, 1] : options.radius.length ?
           options.radius : [options.radius, options.radius, options.radius];
  return CSG.fromPolygons([
    [[0, 4, 6, 2], [-1, 0, 0]],
    [[1, 3, 7, 5], [+1, 0, 0]],
    [[0, 1, 5, 4], [0, -1, 0]],
    [[2, 6, 7, 3], [0, +1, 0]],
    [[0, 2, 3, 1], [0, 0, -1]],
    [[4, 5, 7, 6], [0, 0, +1]]
  ].map(function(info) {
    return new CSG.Polygon(info[0].map(function(i) {
      var pos = new CSG.Vector(
        c.x + r[0] * (2 * !!(i & 1) - 1),
        c.y + r[1] * (2 * !!(i & 2) - 1),
        c.z + r[2] * (2 * !!(i & 4) - 1)
      );
      return new CSG.Vertex(pos, new CSG.Vector(info[1]));
    }));
  }));
};

// Construct a solid sphere. Optional parameters are `center`, `radius`,
// `slices`, and `stacks`, which default to `[0, 0, 0]`, `1`, `16`, and `8`.
// The `slices` and `stacks` parameters control the tessellation along the
// longitude and latitude directions.
// 
// Example usage:
// 
//     var sphere = CSG.sphere({
//       center: [0, 0, 0],
//       radius: 1,
//       slices: 16,
//       stacks: 8
//     });
CSG.sphere = function(options) {
  options = options || {};
  var c = new CSG.Vector(options.center || [0, 0, 0]);
  var r = options.radius || 1;
  var slices = options.slices || 16;
  var stacks = options.stacks || 8;
  var polygons = [], vertices;
  function vertex(theta, phi) {
    theta *= Math.PI * 2;
    phi *= Math.PI;
    var dir = new CSG.Vector(
      Math.cos(theta) * Math.sin(phi),
      Math.cos(phi),
      Math.sin(theta) * Math.sin(phi)
    );
    vertices.push(new CSG.Vertex(c.plus(dir.times(r)), dir));
  }
  for (var i = 0; i < slices; i++) {
    for (var j = 0; j < stacks; j++) {
      vertices = [];
      vertex(i / slices, j / stacks);
      if (j > 0) vertex((i + 1) / slices, j / stacks);
      if (j < stacks - 1) vertex((i + 1) / slices, (j + 1) / stacks);
      vertex(i / slices, (j + 1) / stacks);
      polygons.push(new CSG.Polygon(vertices));
    }
  }
  return CSG.fromPolygons(polygons);
};

// Construct a solid cylinder. Optional parameters are `start`, `end`,
// `radius`, and `slices`, which default to `[0, -1, 0]`, `[0, 1, 0]`, `1`, and
// `16`. The `slices` parameter controls the tessellation.
// 
// Example usage:
// 
//     var cylinder = CSG.cylinder({
//       start: [0, -1, 0],
//       end: [0, 1, 0],
//       radius: 1,
//       slices: 16
//     });
CSG.cylinder = function(options) {
  options = options || {};
  var s = new CSG.Vector(options.start || [0, -1, 0]);
  var e = new CSG.Vector(options.end || [0, 1, 0]);
  var ray = e.minus(s);
  var r = options.radius || 1;
  var slices = options.slices || 16;
  var axisZ = ray.unit(), isY = (Math.abs(axisZ.y) > 0.5);
  var axisX = new CSG.Vector(isY, !isY, 0).cross(axisZ).unit();
  var axisY = axisX.cross(axisZ).unit();
  var start = new CSG.Vertex(s, axisZ.negated());
  var end = new CSG.Vertex(e, axisZ.unit());
  var polygons = [];
  function point(stack, slice, normalBlend) {
    var angle = slice * Math.PI * 2;
    var out = axisX.times(Math.cos(angle)).plus(axisY.times(Math.sin(angle)));
    var pos = s.plus(ray.times(stack)).plus(out.times(r));
    var normal = out.times(1 - Math.abs(normalBlend)).plus(axisZ.times(normalBlend));
    return new CSG.Vertex(pos, normal);
  }
  for (var i = 0; i < slices; i++) {
    var t0 = i / slices, t1 = (i + 1) / slices;
    polygons.push(new CSG.Polygon([start, point(0, t0, -1), point(0, t1, -1)]));
    polygons.push(new CSG.Polygon([point(0, t1, 0), point(0, t0, 0), point(1, t0, 0), point(1, t1, 0)]));
    polygons.push(new CSG.Polygon([end, point(1, t1, 1), point(1, t0, 1)]));
  }
  return CSG.fromPolygons(polygons);
};

// # class Vector

// Represents a 3D vector.
// 
// Example usage:
// 
//     new CSG.Vector(1, 2, 3);
//     new CSG.Vector([1, 2, 3]);
//     new CSG.Vector({ x: 1, y: 2, z: 3 });

CSG.Vector = function(x, y, z) {
  if (arguments.length == 3) {
    this.x = x;
    this.y = y;
    this.z = z;
  } else if ('x' in x) {
    this.x = x.x;
    this.y = x.y;
    this.z = x.z;
  } else {
    this.x = x[0];
    this.y = x[1];
    this.z = x[2];
  }
};

CSG.Vector.prototype = {
  clone: function() {
    return new CSG.Vector(this.x, this.y, this.z);
  },

  negated: function() {
    return new CSG.Vector(-this.x, -this.y, -this.z);
  },

  plus: function(a) {
    return new CSG.Vector(this.x + a.x, this.y + a.y, this.z + a.z);
  },

  minus: function(a) {
    return new CSG.Vector(this.x - a.x, this.y - a.y, this.z - a.z);
  },

  times: function(a) {
    return new CSG.Vector(this.x * a, this.y * a, this.z * a);
  },

  dividedBy: function(a) {
    return new CSG.Vector(this.x / a, this.y / a, this.z / a);
  },

  dot: function(a) {
    return this.x * a.x + this.y * a.y + this.z * a.z;
  },

  lerp: function(a, t) {
    return this.plus(a.minus(this).times(t));
  },

  length: function() {
    return Math.sqrt(this.dot(this));
  },

  unit: function() {
    return this.dividedBy(this.length());
  },

  cross: function(a) {
    return new CSG.Vector(
      this.y * a.z - this.z * a.y,
      this.z * a.x - this.x * a.z,
      this.x * a.y - this.y * a.x
    );
  }
};

// # class Vertex

// Represents a vertex of a polygon. Use your own vertex class instead of this
// one to provide additional features like texture coordinates and vertex
// colors. Custom vertex classes need to provide a `pos` property and `clone()`,
// `flip()`, and `interpolate()` methods that behave analogous to the ones
// defined by `CSG.Vertex`. This class provides `normal` so convenience
// functions like `CSG.sphere()` can return a smooth vertex normal, but `normal`
// is not used anywhere else.

CSG.Vertex = function(pos, normal) {
  this.pos = new CSG.Vector(pos);
  this.normal = new CSG.Vector(normal);
};

CSG.Vertex.prototype = {
  clone: function() {
    return new CSG.Vertex(this.pos.clone(), this.normal.clone());
  },

  // Invert all orientation-specific data (e.g. vertex normal). Called when the
  // orientation of a polygon is flipped.
  flip: function() {
    this.normal = this.normal.negated();
  },

  // Create a new vertex between this vertex and `other` by linearly
  // interpolating all properties using a parameter of `t`. Subclasses should
  // override this to interpolate additional properties.
  interpolate: function(other, t) {
    return new CSG.Vertex(
      this.pos.lerp(other.pos, t),
      this.normal.lerp(other.normal, t)
    );
  },
  rotate: function(m) {
    var p = m.transformVector(this.pos)
    var n = m.transformVector(this.normal);
    return new CSG.Vertex(new CSG.Vector(p.x,p.y,p.z),new CSG.Vector(n.x,n.y,n.z))
  }
};

// # class Plane

// Represents a plane in 3D space.

CSG.Plane = function(normal, w) {
  this.normal = normal;
  this.w = w;
};

// `CSG.Plane.EPSILON` is the tolerance used by `splitPolygon()` to decide if a
// point is on the plane.
CSG.Plane.EPSILON = 1e-5;

CSG.Plane.fromPoints = function(a, b, c) {
  var n = b.minus(a).cross(c.minus(a)).unit();
  return new CSG.Plane(n, n.dot(a));
};

CSG.Plane.prototype = {
  clone: function() {
    return new CSG.Plane(this.normal.clone(), this.w);
  },

  flip: function() {
    this.normal = this.normal.negated();
    this.w = -this.w;
  },

  // Split `polygon` by this plane if needed, then put the polygon or polygon
  // fragments in the appropriate lists. Coplanar polygons go into either
  // `coplanarFront` or `coplanarBack` depending on their orientation with
  // respect to this plane. Polygons in front or in back of this plane go into
  // either `front` or `back`.
  splitPolygon: function(polygon, coplanarFront, coplanarBack, front, back) {
    var COPLANAR = 0;
    var FRONT = 1;
    var BACK = 2;
    var SPANNING = 3;

    // Classify each point as well as the entire polygon into one of the above
    // four classes.
    var polygonType = 0;
    var types = [];
    for (var i = 0; i < polygon.vertices.length; i++) {
      var t = this.normal.dot(polygon.vertices[i].pos) - this.w;
      var type = (t < -CSG.Plane.EPSILON) ? BACK : (t > CSG.Plane.EPSILON) ? FRONT : COPLANAR;
      polygonType |= type;
      types.push(type);
    }

    // Put the polygon in the correct list, splitting it when necessary.
    switch (polygonType) {
      case COPLANAR:
        (this.normal.dot(polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT:
        front.push(polygon);
        break;
      case BACK:
        back.push(polygon);
        break;
      case SPANNING:
        var f = [], b = [];
        for (var i = 0; i < polygon.vertices.length; i++) {
          var j = (i + 1) % polygon.vertices.length;
          var ti = types[i], tj = types[j];
          var vi = polygon.vertices[i], vj = polygon.vertices[j];
          if (ti != BACK) f.push(vi);
          if (ti != FRONT) b.push(ti != BACK ? vi.clone() : vi);
          if ((ti | tj) == SPANNING) {
            var t = (this.w - this.normal.dot(vi.pos)) / this.normal.dot(vj.pos.minus(vi.pos));
            var v = vi.interpolate(vj, t);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) front.push(new CSG.Polygon(f, polygon.shared));
        if (b.length >= 3) back.push(new CSG.Polygon(b, polygon.shared));
        break;
    }
  }
};

// # class Polygon

// Represents a convex polygon. The vertices used to initialize a polygon must
// be coplanar and form a convex loop. They do not have to be `CSG.Vertex`
// instances but they must behave similarly (duck typing can be used for
// customization).
// 
// Each convex polygon has a `shared` property, which is shared between all
// polygons that are clones of each other or were split from the same polygon.
// This can be used to define per-polygon properties (such as surface color).

CSG.Polygon = function(vertices, shared) {
  this.vertices = vertices;
  this.shared = shared;
  this.plane = CSG.Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
};

CSG.Polygon.prototype = {
  clone: function() {
    var vertices = this.vertices.map(function(v) { return v.clone(); });
    return new CSG.Polygon(vertices, this.shared);
  },

  flip: function() {
    this.vertices.reverse().map(function(v) { v.flip(); });
    this.plane.flip();
  },
  translate: function(d){
    this.vertices.forEach(v => v.pos=v.pos.plus(d));
    this.plane.w = this.plane.normal.dot(this.vertices[0]);
    return this;
  }
};

// # class Node

// Holds a node in a BSP tree. A BSP tree is built from a collection of polygons
// by picking a polygon to split along. That polygon (and all other coplanar
// polygons) are added directly to that node and the other polygons are added to
// the front and/or back subtrees. This is not a leafy BSP tree since there is
// no distinction between internal and leaf nodes.

CSG.Node = function(polygons) {
  this.plane = null;
  this.front = null;
  this.back = null;
  this.polygons = [];
  if (polygons) this.build(polygons);
};

CSG.Node.prototype = {
  clone: function() {
    var node = new CSG.Node();
    node.plane = this.plane && this.plane.clone();
    node.front = this.front && this.front.clone();
    node.back = this.back && this.back.clone();
    node.polygons = this.polygons.map(function(p) { return p.clone(); });
    return node;
  },

  // Convert solid space to empty space and empty space to solid space.
  invert: function() {
    for (var i = 0; i < this.polygons.length; i++) {
      this.polygons[i].flip();
    }
    this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    var temp = this.front;
    this.front = this.back;
    this.back = temp;
  },

  // Recursively remove all polygons in `polygons` that are inside this BSP
  // tree.
  clipPolygons: function(polygons) {
    if (!this.plane) return polygons.slice();
    var front = [], back = [];
    for (var i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = [];
    return front.concat(back);
  },

  // Remove all polygons in this BSP tree that are inside the other BSP tree
  // `bsp`.
  clipTo: function(bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  },

  // Return a list of all polygons in this BSP tree.
  allPolygons: function() {
    var polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  },

  // Build a BSP tree out of `polygons`. When called on an existing tree, the
  // new polygons are filtered down to the bottom of the tree and become new
  // nodes there. Each set of polygons is partitioned using the first polygon
  // (no heuristic is used to pick a good split).
  build: function(polygons) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = polygons[0].plane.clone();
    var front = [], back = [];
    for (var i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
    }
    if (front.length) {
      if (!this.front) this.front = new CSG.Node();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new CSG.Node();
      this.back.build(back);
    }
  }
};

module.exports = CSG
},{}],2:[function(require,module,exports){
/*
 * lightgl.js
 * http://github.com/evanw/lightgl.js/
 *
 * Copyright 2011 Evan Wallace
 * Released under the MIT license
 */
var GL=function(){function F(b){return{8:"BACKSPACE",9:"TAB",13:"ENTER",16:"SHIFT",27:"ESCAPE",32:"SPACE",37:"LEFT",38:"UP",39:"RIGHT",40:"DOWN"}[b]||(65<=b&&90>=b?String.fromCharCode(b):null)}function k(){var b=Array.prototype.concat.apply([],arguments);b.length||(b=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);this.m=G?new Float32Array(b):b}function t(){this.unique=[];this.indices=[];this.map={}}function v(b,c){this.buffer=null;this.target=b;this.type=c;this.data=[]}function o(b){b=b||{};this.vertexBuffers=
{};this.indexBuffers={};this.addVertexBuffer("vertices","gl_Vertex");b.coords&&this.addVertexBuffer("coords","gl_TexCoord");b.normals&&this.addVertexBuffer("normals","gl_Normal");b.colors&&this.addVertexBuffer("colors","gl_Color");(!("triangles"in b)||b.triangles)&&this.addIndexBuffer("triangles");b.lines&&this.addIndexBuffer("lines")}function H(b){return new j(2*(b&1)-1,(b&2)-1,(b&4)/2-1)}function u(b,c,a){this.t=arguments.length?b:Number.MAX_VALUE;this.hit=c;this.normal=a}function r(){var b=d.getParameter(d.VIEWPORT),
c=d.modelviewMatrix.m,a=new j(c[0],c[4],c[8]),e=new j(c[1],c[5],c[9]),f=new j(c[2],c[6],c[10]),c=new j(c[3],c[7],c[11]);this.eye=new j(-c.dot(a),-c.dot(e),-c.dot(f));a=b[0];e=a+b[2];f=b[1];c=f+b[3];this.ray00=d.unProject(a,f,1).subtract(this.eye);this.ray10=d.unProject(e,f,1).subtract(this.eye);this.ray01=d.unProject(a,c,1).subtract(this.eye);this.ray11=d.unProject(e,c,1).subtract(this.eye);this.viewport=b}function w(b,c,a){for(;null!=(result=b.exec(c));)a(result)}function E(b,c){function a(a){var b=
document.getElementById(a);return b?b.text:a}function e(a,b){var c={},d=/^((\s*\/\/.*\n|\s*#extension.*\n)+)[^]*$/.exec(b),b=d?d[1]+a+b.substr(d[1].length):a+b;w(/\bgl_\w+\b/g,a,function(a){a in c||(b=b.replace(RegExp("\\b"+a+"\\b","g"),"_"+a),c[a]=!0)});return b}function f(a,b){var c=d.createShader(a);d.shaderSource(c,b);d.compileShader(c);if(!d.getShaderParameter(c,d.COMPILE_STATUS))throw"compile error: "+d.getShaderInfoLog(c);return c}var b=a(b),c=a(c),i=b+c,h={};w(/\b(gl_[^;]*)\b;/g,"uniform mat3 gl_NormalMatrix;uniform mat4 gl_ModelViewMatrix;uniform mat4 gl_ProjectionMatrix;uniform mat4 gl_ModelViewProjectionMatrix;uniform mat4 gl_ModelViewMatrixInverse;uniform mat4 gl_ProjectionMatrixInverse;uniform mat4 gl_ModelViewProjectionMatrixInverse;",
function(a){a=a[1];if(-1!=i.indexOf(a)){var b=a.replace(/[a-z_]/g,"");h[b]="_"+a}});-1!=i.indexOf("ftransform")&&(h.MVPM="_gl_ModelViewProjectionMatrix");this.usedMatrices=h;b=e("uniform mat3 gl_NormalMatrix;uniform mat4 gl_ModelViewMatrix;uniform mat4 gl_ProjectionMatrix;uniform mat4 gl_ModelViewProjectionMatrix;uniform mat4 gl_ModelViewMatrixInverse;uniform mat4 gl_ProjectionMatrixInverse;uniform mat4 gl_ModelViewProjectionMatrixInverse;attribute vec4 gl_Vertex;attribute vec4 gl_TexCoord;attribute vec3 gl_Normal;attribute vec4 gl_Color;vec4 ftransform(){return gl_ModelViewProjectionMatrix*gl_Vertex;}",
b);c=e("precision highp float;uniform mat3 gl_NormalMatrix;uniform mat4 gl_ModelViewMatrix;uniform mat4 gl_ProjectionMatrix;uniform mat4 gl_ModelViewProjectionMatrix;uniform mat4 gl_ModelViewMatrixInverse;uniform mat4 gl_ProjectionMatrixInverse;uniform mat4 gl_ModelViewProjectionMatrixInverse;",c);this.program=d.createProgram();d.attachShader(this.program,f(d.VERTEX_SHADER,b));d.attachShader(this.program,f(d.FRAGMENT_SHADER,c));d.linkProgram(this.program);if(!d.getProgramParameter(this.program,
d.LINK_STATUS))throw"link error: "+d.getProgramInfoLog(this.program);this.attributes={};this.uniformLocations={};var g={};w(/uniform\s+sampler(1D|2D|3D|Cube)\s+(\w+)\s*;/g,b+c,function(a){g[a[2]]=1});this.isSampler=g}function q(b,c,a){a=a||{};this.id=d.createTexture();this.width=b;this.height=c;this.format=a.format||d.RGBA;this.type=a.type||d.UNSIGNED_BYTE;d.bindTexture(d.TEXTURE_2D,this.id);d.pixelStorei(d.UNPACK_FLIP_Y_WEBGL,1);d.texParameteri(d.TEXTURE_2D,d.TEXTURE_MAG_FILTER,a.filter||a.magFilter||
d.LINEAR);d.texParameteri(d.TEXTURE_2D,d.TEXTURE_MIN_FILTER,a.filter||a.minFilter||d.LINEAR);d.texParameteri(d.TEXTURE_2D,d.TEXTURE_WRAP_S,a.wrap||a.wrapS||d.CLAMP_TO_EDGE);d.texParameteri(d.TEXTURE_2D,d.TEXTURE_WRAP_T,a.wrap||a.wrapT||d.CLAMP_TO_EDGE);d.texImage2D(d.TEXTURE_2D,0,this.format,b,c,0,this.format,this.type,null)}function j(b,c,a){this.x=b||0;this.y=c||0;this.z=a||0}var d,s={create:function(b){var b=b||{},c=document.createElement("canvas");c.width=800;c.height=600;"alpha"in b||(b.alpha=
!1);try{d=c.getContext("webgl",b)}catch(a){}try{d=d||c.getContext("experimental-webgl",b)}catch(e){}if(!d)throw"WebGL not supported";d.MODELVIEW=I|1;d.PROJECTION=I|2;var f=new k,i=new k;d.modelviewMatrix=new k;d.projectionMatrix=new k;var h=[],g=[],n,m;d.matrixMode=function(a){switch(a){case d.MODELVIEW:n="modelviewMatrix";m=h;break;case d.PROJECTION:n="projectionMatrix";m=g;break;default:throw"invalid matrix mode "+a;}};d.loadIdentity=function(){k.identity(d[n])};d.loadMatrix=function(a){for(var a=
a.m,b=d[n].m,c=0;c<16;c++)b[c]=a[c]};d.multMatrix=function(a){d.loadMatrix(k.multiply(d[n],a,i))};d.perspective=function(a,b,c,e){d.multMatrix(k.perspective(a,b,c,e,f))};d.frustum=function(a,b,c,e,g,i){d.multMatrix(k.frustum(a,b,c,e,g,i,f))};d.ortho=function(a,b,c,e,g,i){d.multMatrix(k.ortho(a,b,c,e,g,i,f))};d.scale=function(a,b,c){d.multMatrix(k.scale(a,b,c,f))};d.translate=function(a,b,c){d.multMatrix(k.translate(a,b,c,f))};d.rotate=function(a,b,c,e){d.multMatrix(k.rotate(a,b,c,e,f))};d.lookAt=
function(a,b,c,e,g,i,h,j,l){d.multMatrix(k.lookAt(a,b,c,e,g,i,h,j,l,f))};d.pushMatrix=function(){m.push(Array.prototype.slice.call(d[n].m))};d.popMatrix=function(){var a=m.pop();d[n].m=G?new Float32Array(a):a};d.project=function(a,b,c,e,f,g){e=e||d.modelviewMatrix;f=f||d.projectionMatrix;g=g||d.getParameter(d.VIEWPORT);a=f.transformPoint(e.transformPoint(new j(a,b,c)));return new j(g[0]+g[2]*(a.x*0.5+0.5),g[1]+g[3]*(a.y*0.5+0.5),a.z*0.5+0.5)};d.unProject=function(a,b,c,e,g,h){e=e||d.modelviewMatrix;
g=g||d.projectionMatrix;h=h||d.getParameter(d.VIEWPORT);a=new j((a-h[0])/h[2]*2-1,(b-h[1])/h[3]*2-1,c*2-1);return k.inverse(k.multiply(g,e,f),i).transformPoint(a)};d.matrixMode(d.MODELVIEW);var l=new o({coords:!0,colors:!0,triangles:!1}),y=-1,p=[0,0,0,0],q=[1,1,1,1],u=new E("uniform float pointSize;varying vec4 color;varying vec4 coord;void main(){color=gl_Color;coord=gl_TexCoord;gl_Position=gl_ModelViewProjectionMatrix*gl_Vertex;gl_PointSize=pointSize;}",
"uniform sampler2D texture;uniform float pointSize;uniform bool useTexture;varying vec4 color;varying vec4 coord;void main(){gl_FragColor=color;if(useTexture)gl_FragColor*=texture2D(texture,coord.xy);}");d.pointSize=function(a){u.uniforms({pointSize:a})};d.begin=function(a){if(y!=-1)throw"mismatched gl.begin() and gl.end() calls";y=a;l.colors=[];l.coords=[];l.vertices=[]};d.color=function(a,b,c,e){q=arguments.length==1?a.toArray().concat(1):
[a,b,c,e||1]};d.texCoord=function(a,b){p=arguments.length==1?a.toArray(2):[a,b]};d.vertex=function(a,b,c){l.colors.push(q);l.coords.push(p);l.vertices.push(arguments.length==1?a.toArray():[a,b,c])};d.end=function(){if(y==-1)throw"mismatched gl.begin() and gl.end() calls";l.compile();u.uniforms({useTexture:!!d.getParameter(d.TEXTURE_BINDING_2D)}).draw(l,y);y=-1};var r=function(){for(var a in x)if(B.call(x,a)&&x[a])return true;return false},s=function(a){var b={},c;for(c in a)b[c]=typeof a[c]=="function"?
function(b){return function(){b.apply(a,arguments)}}(a[c]):a[c];b.original=a;b.x=b.pageX;b.y=b.pageY;for(c=d.canvas;c;c=c.offsetParent){b.x=b.x-c.offsetLeft;b.y=b.y-c.offsetTop}if(D){b.deltaX=b.x-v;b.deltaY=b.y-w}else{b.deltaX=0;b.deltaY=0;D=true}v=b.x;w=b.y;b.dragging=r();b.preventDefault=function(){b.original.preventDefault()};b.stopPropagation=function(){b.original.stopPropagation()};return b},z=function(a){d=t;a=s(a);if(d.onmousemove)d.onmousemove(a);a.preventDefault()},A=function(a){d=t;x[a.which]=
false;if(!r()){document.removeEventListener("mousemove",z);document.removeEventListener("mouseup",A);d.canvas.addEventListener("mousemove",z);d.canvas.addEventListener("mouseup",A)}a=s(a);if(d.onmouseup)d.onmouseup(a);a.preventDefault()},b=function(){D=false},t=d,v=0,w=0,x={},D=!1,B=Object.prototype.hasOwnProperty;d.canvas.addEventListener("mousedown",function(a){d=t;if(!r()){document.addEventListener("mousemove",z);document.addEventListener("mouseup",A);d.canvas.removeEventListener("mousemove",z);
d.canvas.removeEventListener("mouseup",A)}x[a.which]=true;a=s(a);if(d.onmousedown)d.onmousedown(a);a.preventDefault()});d.canvas.addEventListener("mousemove",z);d.canvas.addEventListener("mouseup",A);d.canvas.addEventListener("mouseover",b);d.canvas.addEventListener("mouseout",b);document.addEventListener("contextmenu",function(){x={};D=false});var C=d;d.makeCurrent=function(){d=C};d.animate=function(){function a(){d=e;var f=(new Date).getTime();if(d.onupdate)d.onupdate((f-c)/1E3);if(d.ondraw)d.ondraw();
b(a);c=f}var b=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||function(a){setTimeout(a,1E3/60)},c=(new Date).getTime(),e=d;a()};d.fullscreen=function(a){function b(){d.canvas.width=window.innerWidth-e-f;d.canvas.height=window.innerHeight-c-g;d.viewport(0,0,d.canvas.width,d.canvas.height);if(a.camera||!("camera"in a)){d.matrixMode(d.PROJECTION);d.loadIdentity();d.perspective(a.fov||45,d.canvas.width/d.canvas.height,a.near||0.1,a.far||1E3);d.matrixMode(d.MODELVIEW)}if(d.ondraw)d.ondraw()}
var a=a||{},c=a.paddingTop||0,e=a.paddingLeft||0,f=a.paddingRight||0,g=a.paddingBottom||0;if(!document.body)throw"document.body doesn't exist yet (call gl.fullscreen() from window.onload() or from inside the <body> tag)";document.body.appendChild(d.canvas);document.body.style.overflow="hidden";d.canvas.style.position="absolute";d.canvas.style.left=e+"px";d.canvas.style.top=c+"px";window.addEventListener("resize",b);b()};return d},keys:{},Matrix:k,Indexer:t,Buffer:v,Mesh:o,HitTest:u,Raytracer:r,Shader:E,
Texture:q,Vector:j};document.addEventListener("keydown",function(b){if(!b.altKey&&!b.ctrlKey&&!b.metaKey){var c=F(b.keyCode);c&&(s.keys[c]=!0);s.keys[b.keyCode]=!0}});document.addEventListener("keyup",function(b){if(!b.altKey&&!b.ctrlKey&&!b.metaKey){var c=F(b.keyCode);c&&(s.keys[c]=!1);s.keys[b.keyCode]=!1}});var I=305397760,G="undefined"!=typeof Float32Array;k.prototype={inverse:function(){return k.inverse(this,new k)},transpose:function(){return k.transpose(this,new k)},multiply:function(b){return k.multiply(this,
b,new k)},transformPoint:function(b){var c=this.m;return(new j(c[0]*b.x+c[1]*b.y+c[2]*b.z+c[3],c[4]*b.x+c[5]*b.y+c[6]*b.z+c[7],c[8]*b.x+c[9]*b.y+c[10]*b.z+c[11])).divide(c[12]*b.x+c[13]*b.y+c[14]*b.z+c[15])},transformVector:function(b){var c=this.m;return new j(c[0]*b.x+c[1]*b.y+c[2]*b.z,c[4]*b.x+c[5]*b.y+c[6]*b.z,c[8]*b.x+c[9]*b.y+c[10]*b.z)}};k.inverse=function(b,c){var c=c||new k,a=b.m,e=c.m;e[0]=a[5]*a[10]*a[15]-a[5]*a[14]*a[11]-a[6]*a[9]*a[15]+a[6]*a[13]*a[11]+a[7]*a[9]*a[14]-a[7]*a[13]*a[10];
e[1]=-a[1]*a[10]*a[15]+a[1]*a[14]*a[11]+a[2]*a[9]*a[15]-a[2]*a[13]*a[11]-a[3]*a[9]*a[14]+a[3]*a[13]*a[10];e[2]=a[1]*a[6]*a[15]-a[1]*a[14]*a[7]-a[2]*a[5]*a[15]+a[2]*a[13]*a[7]+a[3]*a[5]*a[14]-a[3]*a[13]*a[6];e[3]=-a[1]*a[6]*a[11]+a[1]*a[10]*a[7]+a[2]*a[5]*a[11]-a[2]*a[9]*a[7]-a[3]*a[5]*a[10]+a[3]*a[9]*a[6];e[4]=-a[4]*a[10]*a[15]+a[4]*a[14]*a[11]+a[6]*a[8]*a[15]-a[6]*a[12]*a[11]-a[7]*a[8]*a[14]+a[7]*a[12]*a[10];e[5]=a[0]*a[10]*a[15]-a[0]*a[14]*a[11]-a[2]*a[8]*a[15]+a[2]*a[12]*a[11]+a[3]*a[8]*a[14]-
a[3]*a[12]*a[10];e[6]=-a[0]*a[6]*a[15]+a[0]*a[14]*a[7]+a[2]*a[4]*a[15]-a[2]*a[12]*a[7]-a[3]*a[4]*a[14]+a[3]*a[12]*a[6];e[7]=a[0]*a[6]*a[11]-a[0]*a[10]*a[7]-a[2]*a[4]*a[11]+a[2]*a[8]*a[7]+a[3]*a[4]*a[10]-a[3]*a[8]*a[6];e[8]=a[4]*a[9]*a[15]-a[4]*a[13]*a[11]-a[5]*a[8]*a[15]+a[5]*a[12]*a[11]+a[7]*a[8]*a[13]-a[7]*a[12]*a[9];e[9]=-a[0]*a[9]*a[15]+a[0]*a[13]*a[11]+a[1]*a[8]*a[15]-a[1]*a[12]*a[11]-a[3]*a[8]*a[13]+a[3]*a[12]*a[9];e[10]=a[0]*a[5]*a[15]-a[0]*a[13]*a[7]-a[1]*a[4]*a[15]+a[1]*a[12]*a[7]+a[3]*a[4]*
a[13]-a[3]*a[12]*a[5];e[11]=-a[0]*a[5]*a[11]+a[0]*a[9]*a[7]+a[1]*a[4]*a[11]-a[1]*a[8]*a[7]-a[3]*a[4]*a[9]+a[3]*a[8]*a[5];e[12]=-a[4]*a[9]*a[14]+a[4]*a[13]*a[10]+a[5]*a[8]*a[14]-a[5]*a[12]*a[10]-a[6]*a[8]*a[13]+a[6]*a[12]*a[9];e[13]=a[0]*a[9]*a[14]-a[0]*a[13]*a[10]-a[1]*a[8]*a[14]+a[1]*a[12]*a[10]+a[2]*a[8]*a[13]-a[2]*a[12]*a[9];e[14]=-a[0]*a[5]*a[14]+a[0]*a[13]*a[6]+a[1]*a[4]*a[14]-a[1]*a[12]*a[6]-a[2]*a[4]*a[13]+a[2]*a[12]*a[5];e[15]=a[0]*a[5]*a[10]-a[0]*a[9]*a[6]-a[1]*a[4]*a[10]+a[1]*a[8]*a[6]+
a[2]*a[4]*a[9]-a[2]*a[8]*a[5];for(var a=a[0]*e[0]+a[1]*e[4]+a[2]*e[8]+a[3]*e[12],d=0;16>d;d++)e[d]/=a;return c};k.transpose=function(b,c){var c=c||new k,a=b.m,e=c.m;e[0]=a[0];e[1]=a[4];e[2]=a[8];e[3]=a[12];e[4]=a[1];e[5]=a[5];e[6]=a[9];e[7]=a[13];e[8]=a[2];e[9]=a[6];e[10]=a[10];e[11]=a[14];e[12]=a[3];e[13]=a[7];e[14]=a[11];e[15]=a[15];return c};k.multiply=function(b,c,a){var a=a||new k,b=b.m,c=c.m,e=a.m;e[0]=b[0]*c[0]+b[1]*c[4]+b[2]*c[8]+b[3]*c[12];e[1]=b[0]*c[1]+b[1]*c[5]+b[2]*c[9]+b[3]*c[13];e[2]=
b[0]*c[2]+b[1]*c[6]+b[2]*c[10]+b[3]*c[14];e[3]=b[0]*c[3]+b[1]*c[7]+b[2]*c[11]+b[3]*c[15];e[4]=b[4]*c[0]+b[5]*c[4]+b[6]*c[8]+b[7]*c[12];e[5]=b[4]*c[1]+b[5]*c[5]+b[6]*c[9]+b[7]*c[13];e[6]=b[4]*c[2]+b[5]*c[6]+b[6]*c[10]+b[7]*c[14];e[7]=b[4]*c[3]+b[5]*c[7]+b[6]*c[11]+b[7]*c[15];e[8]=b[8]*c[0]+b[9]*c[4]+b[10]*c[8]+b[11]*c[12];e[9]=b[8]*c[1]+b[9]*c[5]+b[10]*c[9]+b[11]*c[13];e[10]=b[8]*c[2]+b[9]*c[6]+b[10]*c[10]+b[11]*c[14];e[11]=b[8]*c[3]+b[9]*c[7]+b[10]*c[11]+b[11]*c[15];e[12]=b[12]*c[0]+b[13]*c[4]+b[14]*
c[8]+b[15]*c[12];e[13]=b[12]*c[1]+b[13]*c[5]+b[14]*c[9]+b[15]*c[13];e[14]=b[12]*c[2]+b[13]*c[6]+b[14]*c[10]+b[15]*c[14];e[15]=b[12]*c[3]+b[13]*c[7]+b[14]*c[11]+b[15]*c[15];return a};k.identity=function(b){var b=b||new k,c=b.m;c[0]=c[5]=c[10]=c[15]=1;c[1]=c[2]=c[3]=c[4]=c[6]=c[7]=c[8]=c[9]=c[11]=c[12]=c[13]=c[14]=0;return b};k.perspective=function(b,c,a,e,d){b=Math.tan(b*Math.PI/360)*a;c*=b;return k.frustum(-c,c,-b,b,a,e,d)};k.frustum=function(b,c,a,e,d,i,h){var h=h||new k,g=h.m;g[0]=2*d/(c-b);g[1]=
0;g[2]=(c+b)/(c-b);g[3]=0;g[4]=0;g[5]=2*d/(e-a);g[6]=(e+a)/(e-a);g[7]=0;g[8]=0;g[9]=0;g[10]=-(i+d)/(i-d);g[11]=-2*i*d/(i-d);g[12]=0;g[13]=0;g[14]=-1;g[15]=0;return h};k.ortho=function(b,c,a,e,d,i,h){var h=h||new k,g=h.m;g[0]=2/(c-b);g[1]=0;g[2]=0;g[3]=-(c+b)/(c-b);g[4]=0;g[5]=2/(e-a);g[6]=0;g[7]=-(e+a)/(e-a);g[8]=0;g[9]=0;g[10]=-2/(i-d);g[11]=-(i+d)/(i-d);g[12]=0;g[13]=0;g[14]=0;g[15]=1;return h};k.scale=function(b,c,a,d){var d=d||new k,f=d.m;f[0]=b;f[1]=0;f[2]=0;f[3]=0;f[4]=0;f[5]=c;f[6]=0;f[7]=
0;f[8]=0;f[9]=0;f[10]=a;f[11]=0;f[12]=0;f[13]=0;f[14]=0;f[15]=1;return d};k.translate=function(b,c,a,d){var d=d||new k,f=d.m;f[0]=1;f[1]=0;f[2]=0;f[3]=b;f[4]=0;f[5]=1;f[6]=0;f[7]=c;f[8]=0;f[9]=0;f[10]=1;f[11]=a;f[12]=0;f[13]=0;f[14]=0;f[15]=1;return d};k.rotate=function(b,c,a,d,f){if(!b||!c&&!a&&!d)return k.identity(f);var f=f||new k,i=f.m,h=Math.sqrt(c*c+a*a+d*d),b=b*(Math.PI/180),c=c/h,a=a/h,d=d/h,h=Math.cos(b),b=Math.sin(b),g=1-h;i[0]=c*c*g+h;i[1]=c*a*g-d*b;i[2]=c*d*g+a*b;i[3]=0;i[4]=a*c*g+d*b;
i[5]=a*a*g+h;i[6]=a*d*g-c*b;i[7]=0;i[8]=d*c*g-a*b;i[9]=d*a*g+c*b;i[10]=d*d*g+h;i[11]=0;i[12]=0;i[13]=0;i[14]=0;i[15]=1;return f};k.lookAt=function(b,c,a,d,f,i,h,g,n,m){var m=m||new k,l=m.m,b=new j(b,c,a),d=new j(d,f,i),g=new j(h,g,n),h=b.subtract(d).unit(),g=g.cross(h).unit(),n=h.cross(g).unit();l[0]=g.x;l[1]=g.y;l[2]=g.z;l[3]=-g.dot(b);l[4]=n.x;l[5]=n.y;l[6]=n.z;l[7]=-n.dot(b);l[8]=h.x;l[9]=h.y;l[10]=h.z;l[11]=-h.dot(b);l[12]=0;l[13]=0;l[14]=0;l[15]=1;return m};t.prototype={add:function(b){var c=
JSON.stringify(b);c in this.map||(this.map[c]=this.unique.length,this.unique.push(b));return this.map[c]}};v.prototype={compile:function(b){for(var c=[],a=0;a<this.data.length;a+=1E4)c=Array.prototype.concat.apply(c,this.data.slice(a,a+1E4));a=this.data.length?c.length/this.data.length:0;if(a!=Math.round(a))throw"buffer elements not of consistent size, average size is "+a;this.buffer=this.buffer||d.createBuffer();this.buffer.length=c.length;this.buffer.spacing=a;d.bindBuffer(this.target,this.buffer);
d.bufferData(this.target,new this.type(c),b||d.STATIC_DRAW)}};o.prototype={addVertexBuffer:function(b,c){(this.vertexBuffers[c]=new v(d.ARRAY_BUFFER,Float32Array)).name=b;this[b]=[]},addIndexBuffer:function(b){this.indexBuffers[b]=new v(d.ELEMENT_ARRAY_BUFFER,Uint16Array);this[b]=[]},compile:function(){for(var b in this.vertexBuffers){var c=this.vertexBuffers[b];c.data=this[c.name];c.compile()}for(var a in this.indexBuffers)c=this.indexBuffers[a],c.data=this[a],c.compile()},transform:function(b){this.vertices=
this.vertices.map(function(a){return b.transformPoint(j.fromArray(a)).toArray()});if(this.normals){var c=b.inverse().transpose();this.normals=this.normals.map(function(a){return c.transformVector(j.fromArray(a)).unit().toArray()})}this.compile();return this},computeNormals:function(){this.normals||this.addVertexBuffer("normals","gl_Normal");for(var b=0;b<this.vertices.length;b++)this.normals[b]=new j;for(b=0;b<this.triangles.length;b++){var c=this.triangles[b],a=j.fromArray(this.vertices[c[0]]),d=
j.fromArray(this.vertices[c[1]]),f=j.fromArray(this.vertices[c[2]]),a=d.subtract(a).cross(f.subtract(a)).unit();this.normals[c[0]]=this.normals[c[0]].add(a);this.normals[c[1]]=this.normals[c[1]].add(a);this.normals[c[2]]=this.normals[c[2]].add(a)}for(b=0;b<this.vertices.length;b++)this.normals[b]=this.normals[b].unit().toArray();this.compile();return this},computeWireframe:function(){for(var b=new t,c=0;c<this.triangles.length;c++)for(var a=this.triangles[c],d=0;d<a.length;d++){var f=a[d],i=a[(d+
1)%a.length];b.add([Math.min(f,i),Math.max(f,i)])}this.lines||this.addIndexBuffer("lines");this.lines=b.unique;this.compile();return this},getAABB:function(){var b={min:new j(Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE)};b.max=b.min.negative();for(var c=0;c<this.vertices.length;c++){var a=j.fromArray(this.vertices[c]);b.min=j.min(b.min,a);b.max=j.max(b.max,a)}return b},getBoundingSphere:function(){for(var b=this.getAABB(),b={center:b.min.add(b.max).divide(2),radius:0},c=0;c<this.vertices.length;c++)b.radius=
Math.max(b.radius,j.fromArray(this.vertices[c]).subtract(b.center).length());return b}};o.plane=function(b){var b=b||{},c=new o(b);detailX=b.detailX||b.detail||1;detailY=b.detailY||b.detail||1;for(b=0;b<=detailY;b++)for(var a=b/detailY,d=0;d<=detailX;d++){var f=d/detailX;c.vertices.push([2*f-1,2*a-1,0]);c.coords&&c.coords.push([f,a]);c.normals&&c.normals.push([0,0,1]);d<detailX&&b<detailY&&(f=d+b*(detailX+1),c.triangles.push([f,f+1,f+detailX+1]),c.triangles.push([f+detailX+1,f+1,f+detailX+2]))}c.compile();
return c};var J=[[0,4,2,6,-1,0,0],[1,3,5,7,1,0,0],[0,1,4,5,0,-1,0],[2,6,3,7,0,1,0],[0,2,1,3,0,0,-1],[4,5,6,7,0,0,1]];o.cube=function(b){for(var b=new o(b),c=0;c<J.length;c++){for(var a=J[c],d=4*c,f=0;4>f;f++)b.vertices.push(H(a[f]).toArray()),b.coords&&b.coords.push([f&1,(f&2)/2]),b.normals&&b.normals.push(a.slice(4,7));b.triangles.push([d,d+1,d+2]);b.triangles.push([d+2,d+1,d+3])}b.compile();return b};o.sphere=function(b){var b=b||{},c=new o(b),a=new t;detail=b.detail||6;for(b=0;8>b;b++)for(var d=
H(b),f=0<d.x*d.y*d.z,i=[],h=0;h<=detail;h++){for(var g=0;h+g<=detail;g++){var k=h/detail,m=g/detail,l=(detail-h-g)/detail,m={vertex:(new j(k+(k-k*k)/2,m+(m-m*m)/2,l+(l-l*l)/2)).unit().multiply(d).toArray()};c.coords&&(m.coord=0<d.y?[1-k,l]:[l,1-k]);i.push(a.add(m))}if(0<h)for(g=0;h+g<=detail;g++)k=(h-1)*(detail+1)+(h-1-(h-1)*(h-1))/2+g,m=h*(detail+1)+(h-h*h)/2+g,c.triangles.push(f?[i[k],i[m],i[k+1]]:[i[k],i[k+1],i[m]]),h+g<detail&&c.triangles.push(f?[i[m],i[m+1],i[k+1]]:[i[m],i[k+1],i[m+1]])}c.vertices=
a.unique.map(function(a){return a.vertex});c.coords&&(c.coords=a.unique.map(function(a){return a.coord}));c.normals&&(c.normals=c.vertices);c.compile();return c};o.load=function(b,c){c=c||{};"coords"in c||(c.coords=!!b.coords);"normals"in c||(c.normals=!!b.normals);"colors"in c||(c.colors=!!b.colors);"triangles"in c||(c.triangles=!!b.triangles);"lines"in c||(c.lines=!!b.lines);var a=new o(c);a.vertices=b.vertices;a.coords&&(a.coords=b.coords);a.normals&&(a.normals=b.normals);a.colors&&(a.colors=b.colors);
a.triangles&&(a.triangles=b.triangles);a.lines&&(a.lines=b.lines);a.compile();return a};u.prototype={mergeWith:function(b){0<b.t&&b.t<this.t&&(this.t=b.t,this.hit=b.hit,this.normal=b.normal)}};r.prototype={getRayForPixel:function(b,c){var b=(b-this.viewport[0])/this.viewport[2],c=1-(c-this.viewport[1])/this.viewport[3],a=j.lerp(this.ray00,this.ray10,b),d=j.lerp(this.ray01,this.ray11,b);return j.lerp(a,d,c).unit()}};r.hitTestBox=function(b,c,a,d){var f=a.subtract(b).divide(c),i=d.subtract(b).divide(c),
h=j.min(f,i),f=j.max(f,i),h=h.max(),f=f.min();return 0<h&&h<f?(b=b.add(c.multiply(h)),a=a.add(1E-6),d=d.subtract(1E-6),new u(h,b,new j((b.x>d.x)-(b.x<a.x),(b.y>d.y)-(b.y<a.y),(b.z>d.z)-(b.z<a.z)))):null};r.hitTestSphere=function(b,c,a,d){var f=b.subtract(a),i=c.dot(c),h=2*c.dot(f),f=f.dot(f)-d*d,f=h*h-4*i*f;return 0<f?(i=(-h-Math.sqrt(f))/(2*i),b=b.add(c.multiply(i)),new u(i,b,b.subtract(a).divide(d))):null};r.hitTestTriangle=function(b,c,a,d,f){var i=d.subtract(a),h=f.subtract(a),f=i.cross(h).unit(),
d=f.dot(a.subtract(b))/f.dot(c);if(0<d){var b=b.add(c.multiply(d)),g=b.subtract(a),a=h.dot(h),c=h.dot(i),h=h.dot(g),j=i.dot(i),i=i.dot(g),g=a*j-c*c,j=(j*h-c*i)/g,i=(a*i-c*h)/g;if(0<=j&&0<=i&&1>=j+i)return new u(d,b,f)}return null};new k;new k;E.prototype={uniforms:function(b){d.useProgram(this.program);for(var c in b){var a=this.uniformLocations[c]||d.getUniformLocation(this.program,c);if(a){this.uniformLocations[c]=a;var e=b[c];e instanceof j?e=[e.x,e.y,e.z]:e instanceof k&&(e=e.m);var f=Object.prototype.toString.call(e);
if("[object Array]"==f||"[object Float32Array]"==f)switch(e.length){case 1:d.uniform1fv(a,new Float32Array(e));break;case 2:d.uniform2fv(a,new Float32Array(e));break;case 3:d.uniform3fv(a,new Float32Array(e));break;case 4:d.uniform4fv(a,new Float32Array(e));break;case 9:d.uniformMatrix3fv(a,!1,new Float32Array([e[0],e[3],e[6],e[1],e[4],e[7],e[2],e[5],e[8]]));break;case 16:d.uniformMatrix4fv(a,!1,new Float32Array([e[0],e[4],e[8],e[12],e[1],e[5],e[9],e[13],e[2],e[6],e[10],e[14],e[3],e[7],e[11],e[15]]));
break;default:throw"don't know how to load uniform \""+c+'" of length '+e.length;}else if(f=Object.prototype.toString.call(e),"[object Number]"==f||"[object Boolean]"==f)(this.isSampler[c]?d.uniform1i:d.uniform1f).call(d,a,e);else throw'attempted to set uniform "'+c+'" to invalid value '+e;}}return this},draw:function(b,c){this.drawBuffers(b.vertexBuffers,b.indexBuffers[c==d.LINES?"lines":"triangles"],2>arguments.length?d.TRIANGLES:c)},drawBuffers:function(b,c,a){var e=this.usedMatrices,f=d.modelviewMatrix,
i=d.projectionMatrix,h=e.MVMI||e.NM?f.inverse():null,g=e.PMI?i.inverse():null,j=e.MVPM||e.MVPMI?i.multiply(f):null,k={};e.MVM&&(k[e.MVM]=f);e.MVMI&&(k[e.MVMI]=h);e.PM&&(k[e.PM]=i);e.PMI&&(k[e.PMI]=g);e.MVPM&&(k[e.MVPM]=j);e.MVPMI&&(k[e.MVPMI]=j.inverse());e.NM&&(f=h.m,k[e.NM]=[f[0],f[4],f[8],f[1],f[5],f[9],f[2],f[6],f[10]]);this.uniforms(k);var e=0,l;for(l in b)k=b[l],f=this.attributes[l]||d.getAttribLocation(this.program,l.replace(/^gl_/,"_gl_")),-1!=f&&k.buffer&&(this.attributes[l]=f,d.bindBuffer(d.ARRAY_BUFFER,
k.buffer),d.enableVertexAttribArray(f),d.vertexAttribPointer(f,k.buffer.spacing,d.FLOAT,!1,0,0),e=k.buffer.length/k.buffer.spacing);for(l in this.attributes)l in b||d.disableVertexAttribArray(this.attributes[l]);if(e&&(!c||c.buffer))c?(d.bindBuffer(d.ELEMENT_ARRAY_BUFFER,c.buffer),d.drawElements(a,c.buffer.length,d.UNSIGNED_SHORT,0)):d.drawArrays(a,0,e);return this}};var B,p,C;q.prototype={bind:function(b){d.activeTexture(d.TEXTURE0+(b||0));d.bindTexture(d.TEXTURE_2D,this.id)},unbind:function(b){d.activeTexture(d.TEXTURE0+
(b||0));d.bindTexture(d.TEXTURE_2D,null)},drawTo:function(b){var c=d.getParameter(d.VIEWPORT);B=B||d.createFramebuffer();p=p||d.createRenderbuffer();d.bindFramebuffer(d.FRAMEBUFFER,B);d.bindRenderbuffer(d.RENDERBUFFER,p);if(this.width!=p.width||this.height!=p.height)p.width=this.width,p.height=this.height,d.renderbufferStorage(d.RENDERBUFFER,d.DEPTH_COMPONENT16,this.width,this.height);d.framebufferTexture2D(d.FRAMEBUFFER,d.COLOR_ATTACHMENT0,d.TEXTURE_2D,this.id,0);d.framebufferRenderbuffer(d.FRAMEBUFFER,
d.DEPTH_ATTACHMENT,d.RENDERBUFFER,p);d.viewport(0,0,this.width,this.height);b();d.bindFramebuffer(d.FRAMEBUFFER,null);d.bindRenderbuffer(d.RENDERBUFFER,null);d.viewport(c[0],c[1],c[2],c[3])},swapWith:function(b){var c;c=b.id;b.id=this.id;this.id=c;c=b.width;b.width=this.width;this.width=c;c=b.height;b.height=this.height;this.height=c}};q.fromImage=function(b,c){var c=c||{},a=new q(b.width,b.height,c);try{d.texImage2D(d.TEXTURE_2D,0,a.format,a.format,a.type,b)}catch(e){if("file:"==location.protocol)throw'image not loaded for security reasons (serve this page over "http://" instead)';
throw"image not loaded for security reasons (image must originate from the same domain as this page or use Cross-Origin Resource Sharing)";}c.minFilter&&(c.minFilter!=d.NEAREST&&c.minFilter!=d.LINEAR)&&d.generateMipmap(d.TEXTURE_2D);return a};q.fromURL=function(b,c){var a;if(!(a=C)){a=document.createElement("canvas").getContext("2d");a.canvas.width=a.canvas.height=128;for(var e=0;e<a.canvas.height;e+=16)for(var f=0;f<a.canvas.width;f+=16)a.fillStyle=(f^e)&16?"#FFF":"#DDD",a.fillRect(f,e,16,16);a=
a.canvas}C=a;var i=q.fromImage(C,c),h=new Image,g=d;h.onload=function(){g.makeCurrent();q.fromImage(h,c).swapWith(i)};h.src=b;return i};j.prototype={negative:function(){return new j(-this.x,-this.y,-this.z)},add:function(b){return b instanceof j?new j(this.x+b.x,this.y+b.y,this.z+b.z):new j(this.x+b,this.y+b,this.z+b)},subtract:function(b){return b instanceof j?new j(this.x-b.x,this.y-b.y,this.z-b.z):new j(this.x-b,this.y-b,this.z-b)},multiply:function(b){return b instanceof j?new j(this.x*b.x,this.y*
b.y,this.z*b.z):new j(this.x*b,this.y*b,this.z*b)},divide:function(b){return b instanceof j?new j(this.x/b.x,this.y/b.y,this.z/b.z):new j(this.x/b,this.y/b,this.z/b)},equals:function(b){return this.x==b.x&&this.y==b.y&&this.z==b.z},dot:function(b){return this.x*b.x+this.y*b.y+this.z*b.z},cross:function(b){return new j(this.y*b.z-this.z*b.y,this.z*b.x-this.x*b.z,this.x*b.y-this.y*b.x)},length:function(){return Math.sqrt(this.dot(this))},unit:function(){return this.divide(this.length())},min:function(){return Math.min(Math.min(this.x,
this.y),this.z)},max:function(){return Math.max(Math.max(this.x,this.y),this.z)},toAngles:function(){return{theta:Math.atan2(this.z,this.x),phi:Math.asin(this.y/this.length())}},toArray:function(b){return[this.x,this.y,this.z].slice(0,b||3)},clone:function(){return new j(this.x,this.y,this.z)},init:function(b,c,a){this.x=b;this.y=c;this.z=a;return this}};j.negative=function(b,c){c.x=-b.x;c.y=-b.y;c.z=-b.z;return c};j.add=function(b,c,a){c instanceof j?(a.x=b.x+c.x,a.y=b.y+c.y,a.z=b.z+c.z):(a.x=b.x+
c,a.y=b.y+c,a.z=b.z+c);return a};j.subtract=function(b,c,a){c instanceof j?(a.x=b.x-c.x,a.y=b.y-c.y,a.z=b.z-c.z):(a.x=b.x-c,a.y=b.y-c,a.z=b.z-c);return a};j.multiply=function(b,c,a){c instanceof j?(a.x=b.x*c.x,a.y=b.y*c.y,a.z=b.z*c.z):(a.x=b.x*c,a.y=b.y*c,a.z=b.z*c);return a};j.divide=function(b,c,a){c instanceof j?(a.x=b.x/c.x,a.y=b.y/c.y,a.z=b.z/c.z):(a.x=b.x/c,a.y=b.y/c,a.z=b.z/c);return a};j.cross=function(b,c,a){a.x=b.y*c.z-b.z*c.y;a.y=b.z*c.x-b.x*c.z;a.z=b.x*c.y-b.y*c.x;return a};j.unit=function(b,
c){var a=b.length();c.x=b.x/a;c.y=b.y/a;c.z=b.z/a;return c};j.fromAngles=function(b,c){return new j(Math.cos(b)*Math.cos(c),Math.sin(c),Math.sin(b)*Math.cos(c))};j.randomDirection=function(){return j.fromAngles(2*Math.random()*Math.PI,Math.asin(2*Math.random()-1))};j.min=function(b,c){return new j(Math.min(b.x,c.x),Math.min(b.y,c.y),Math.min(b.z,c.z))};j.max=function(b,c){return new j(Math.max(b.x,c.x),Math.max(b.y,c.y),Math.max(b.z,c.z))};j.lerp=function(b,c,a){return c.subtract(b).multiply(a).add(b)};
j.fromArray=function(b){return new j(b[0],b[1],b[2])};return s}();
module.exports = GL;
},{}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var more_1 = require("./more");
var CSG = require("./csg.js");
var Viewer = require("./viewer.js");
console.log(Viewer);
var box = {
    outline: {
        width: 81,
        depth: 79,
        height: 40
    },
    internal: {
        width: 81 + 10,
        depth: 79 + 10,
        height: 40
    },
    thickness: {
        body: {
            wall: 2,
            base: 2
        },
        lid: {
            outer: 2
        }
    },
    other: {
        corner_radius: 10,
        catch: {
            height: 5,
            width: 20,
            depth: 5
        }
    },
    mount: {
        radius: 4,
        height: 4,
        hole: {
            height: 3,
            inner_radius: 2,
            outer_radius: 3,
        },
        locations: [
            {
                x: -5,
                y: 24
            },
            {
                x: -5,
                y: 60
            },
            {
                x: 31,
                y: 25
            },
            {
                x: 7.5,
                y: 60
            }
        ]
    },
    lid_mount: {
        radius: 6,
        height: 4,
        hole: {
            height: 3,
            radius: 2,
        },
    }
};
function box_contour(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new more_1.Line(width / 2, 0).line(0, hc / 2).arc({ rx: radius }).line(-wc, 0).arc({ rx: radius, start: Math.PI / 2 }).line(0, -hc).arc({ rx: radius, start: Math.PI }).line(wc, 0).arc({ rx: radius, start: Math.PI * 1.5 });
    return pl.toPolygon();
}
function box_contour3(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new more_1.Line(width / 2, 0).line(0, hc / 2).line(-radius, radius).line(-wc, 0).line(-radius, -radius).line(0, -hc).line(radius, -radius).line(wc, 0).line(radius, radius);
    return pl.toPolygon();
}
function make_mount(loc) {
    var md = box.mount;
    var i = box.outline;
    var th = box.thickness.body.base + md.height;
    var m = new more_1.Line(md.radius, 0).arc({ rx: md.radius, arc: 2 * Math.PI, slices: 24 }).toPolygon();
    var mc = more_1.extrude(m, [0, 0, th]);
    var hole = new more_1.Line(md.hole.outer_radius, 0).arc({ rx: md.hole.outer_radius, arc: 2 * Math.PI, slices: 6 }).toPolygon();
    var holep = more_1.extrude(hole, [0, 0, md.hole.height]);
    hole = new more_1.Line(md.hole.inner_radius, 0).arc({ rx: md.hole.inner_radius, arc: 2 * Math.PI, slices: 12 })
        .toPolygon();
    holep = holep.union(more_1.extrude(hole, [0, 0, th]));
    more_1.translate(mc, loc);
    more_1.translate(holep, loc);
    return [mc, holep];
}
function make_lid_mount(body, loc) {
    var md = box.lid_mount;
    var i = box.outline;
    var m = more_1.Line.rect(md.radius).toPolygon();
    var m = more_1.extrude(m, [0, 0, md.height]);
    var hole = more_1.Line.circle(md.hole.radius).toPolygon();
    var holep = more_1.extrude(hole, [0, 0, md.height]);
    var axis = new CSG.Vector(0, 1, 0);
    m = more_1.rotate(m, 90, axis);
    holep = more_1.rotate(holep, 90, axis);
    more_1.translate(m, loc);
    more_1.translate(holep, loc);
    return body.union(m).subtract(holep);
}
function add_mounts(body) {
    var md = box.mount;
    var i = box.outline;
    md.locations.forEach(function (l) {
        var m = make_mount([(l.x > 0 ? -1 : 1) * i.width / 2 + l.x, (l.y > 0 ? -1 : 1) * i.depth / 2 + l.y, 0]);
        body = body.union(m[0]);
        body = body.subtract(m[1]);
    });
    var i = box.internal;
    var ld = box.lid_mount;
    var h = i.height - ld.radius - box.thickness.lid.outer;
    body = make_lid_mount(body, new CSG.Vector(-i.width / 2, 0, h));
    body = make_lid_mount(body, new CSG.Vector(i.width / 2 - ld.height, 0, h));
    return body;
}
function outline() {
    var i = box.outline;
    var poly = new more_1.Line(i.width / 2, 0).line(0, i.depth / 2).line(-i.width, 0).line(0, -i.depth).line(i.width, 0).line(0, i.depth / 2).toPolygon({ z: 10 });
    return CSG.fromPolygons([poly]);
}
function body() {
    var i = box.internal;
    var tb = box.thickness.body;
    var tl = box.thickness.lid;
    var cr = box.other.corner_radius;
    var outer = more_1.extrude(box_contour(i.width, i.depth, cr), [0, 0, i.height]);
    var inner = more_1.extrude(box_contour(i.width - tb.wall * 2, i.depth - tb.wall * 2, cr - tb.wall / 2), [0, 0, i.height - tb.base]);
    more_1.translate(inner, [0, 0, tb.base]);
    var shell = outer.subtract(inner);
    // cut out lid slot
    var lid_outer = more_1.extrude(box_contour(i.width - tb.wall, i.depth - tb.wall, cr), [0, 0, tl.outer]);
    more_1.translate(lid_outer, [0, 0, i.height - tl.outer]);
    shell = shell.subtract(lid_outer);
    // // add lid catch
    // var lc = box.other.catch
    // var cat = new Line(0, 0).line(0, lc.height).line(-lc.depth, 0).line(0, -lc.height).translate(i.width / 2, i.height - 0.5).toPolygon({ y: -lc.width / 2 })
    // lc = extrude(cat, [0, lc.width, 0])
    // add lid hook
    // var hook = new Line(0, 0).line(0, 1).line(-lc.depth, 0).line(0, -lc.height).close().translate(i.width / 2, i.height - 0.5).toPolygon({ y: -lc.width / 2 })
    // lc = extrude({ polygon: cat, d: [0, lc.width, 0] })
    //  shell = shell.union(lc);
    // mounts
    shell = add_mounts(shell);
    return shell;
}
Viewer.addViewer(new Viewer([body() /*,outline()*/], 500, 500, 500));

},{"./csg.js":1,"./more":4,"./viewer.js":5}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CSG = require("./csg.js");
var GL = require("./lightgl.js");
Array.prototype.get = function (i) {
    if (i < 0)
        return this[this.length + i];
    if (i >= this.length)
        return this[i - this.length];
    return this[i];
};
function download(data, filename, type) {
    var file = new Blob([data], { type: type });
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"), url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
}
exports.download = download;
var hint = 0.00001;
function poly() {
    var pts = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        pts[_i] = arguments[_i];
    }
    if (pts[0] instanceof Array)
        pts = pts.map(function (e) { return new CSG.Vector(e); });
    var n = faceNormal(pts, 0);
    if (isNaN(n.x)) {
        console.log(pts);
        throw "bad face normal";
    }
    return new CSG.Polygon(pts.map(function (p) { return new CSG.Vertex(p, n); }));
}
function faceNormal(vs, idx) {
    var v1 = vs[1 + idx].minus(vs[0]);
    var v2 = vs[2 + idx].minus(vs[0]);
    return v1.cross(v2).unit();
}
function annulus(_a) {
    var height = _a.height, outer = _a.outer, inner = _a.inner, _b = _a.slices, slices = _b === void 0 ? 16 : _b;
    var oc = CSG.cylinder({
        start: [0, 0, -height / 2],
        end: [0, 0, height / 2],
        radius: outer,
        slices: (slices * outer / inner) | 0
    });
    var ic = CSG.cylinder({
        start: [0, 0, -height / 2 - hint],
        end: [0, 0, height / 2 + hint],
        radius: inner,
        slices: slices
    });
    return oc.subtract(ic);
}
function slot(_a) {
    var height = _a.height, length = _a.length, head = _a.head, shaft = _a.shaft, _b = _a.slices, slices = _b === void 0 ? 16 : _b;
    var lc = CSG.cylinder({
        start: [-length / 2, 0, -height / 2],
        end: [-length / 2, 0, height / 2],
        radius: shaft,
        slices: slices
    });
    var bc = CSG.cylinder({
        start: [length / 2, 0, -height / 2],
        end: [length / 2, 0, height / 2],
        radius: head,
        slices: slices
    });
    var box = CSG.cube({ radius: [length / 2 + hint, shaft, height / 2] });
    return lc.union(bc).union(box);
}
function rect(_a) {
    var x = _a.x, y = _a.y, _b = _a.z, z = _b === void 0 ? 0 : _b;
    return poly([x / 2, y / 2, z], [-x / 2, y / 2]);
}
function hexagon(_a) {
    var r = _a.r, _b = _a.z, z = _b === void 0 ? 0 : _b;
    var H = Math.sin(Math.PI * 60 / 180) * r;
    var W = Math.cos(Math.PI * 60 / 180) * r;
    return poly([r, 0, z], [W, H, z], [-W, H, z], [-r, 0, z], [-W, -H, z], [W, -H, z], [r, 0, z]);
}
function extrude(polygon, d) {
    if (d instanceof Array)
        d = new CSG.Vector(d);
    return prism([polygon, polygon.clone().translate(d)]);
}
exports.extrude = extrude;
function prism(polygons) {
    var idx = 0;
    var first = polygons[idx++];
    var ps = [first];
    while (true) {
        var last = polygons[idx++];
        if (!last)
            break;
        var d = last.vertices[0].pos.minus(first.vertices[0].pos);
        if (first.plane.normal.dot(d) > 0)
            first.flip();
        if (last.plane.normal.dot(d) < 0)
            last.flip();
        var l = first.vertices.length - 1;
        for (var i = 0; i <= l; i++) {
            ps.push(poly(first.vertices[i].pos, last.vertices[l - i].pos, last.vertices.get(l - i - 1).pos, first.vertices.get(i + 1).pos, first.vertices[i].pos));
        }
        first = last;
    }
    ps.push(first);
    return CSG.fromPolygons(ps);
}
exports.prism = prism;
// function triangle({ r, z = 0 }) {
//   return poly([0, 0, -l], [0, r, -l], [r, 0, -l][0, 0, -l])
// }
function translate(c, v) {
    if (v instanceof Array)
        v = new CSG.Vector(v);
    c.polygons.forEach(function (e) {
        e.vertices.forEach(function (ev) { return ev.pos = ev.pos.plus(v); });
        e.plane.w = e.plane.normal.dot(e.vertices[0]);
    });
}
exports.translate = translate;
function rotate(c, a, v) {
    var m = GL.Matrix.rotate(a, v.x, v.y, v.z);
    var p = [];
    c.polygons.forEach(function (e) {
        p.push(new CSG.Polygon(e.vertices.map(function (ev) { return ev.rotate(m); })));
    });
    return CSG.fromPolygons(p);
}
exports.rotate = rotate;
var Line = /** @class */ (function () {
    function Line(x, y) {
        if (x !== undefined) {
            this.loc = [x, y];
            this.points = [this.loc];
        }
    }
    Line.prototype.clone = function () {
        var l2 = new Line();
        l2.points = [];
        this.points.forEach(function (p) { return l2.points.push([p[0], p[1]]); });
        l2.locToLast();
        return l2;
    };
    Line.prototype.moveTo = function (x, y) {
        this.loc = [x, y];
        return this;
    };
    Line.prototype.lineTo = function (x, y) {
        this.points.push(this.loc = [x, y]);
        return this;
    };
    Line.prototype.line = function (x, y) {
        this.points.push([this.loc[0] + x, this.loc[1] + y]);
        this.locToLast();
        return this;
    };
    Line.prototype.locToLast = function () {
        this.loc = this.points[this.points.length - 1];
    };
    Line.prototype.move = function (x, y) {
        this.loc = [this.loc[0] + x, this.loc[1] + y];
        return this;
    };
    Line.prototype.translate = function (x, y) {
        this.points.forEach(function (v) {
            v[0] += x;
            v[1] += y;
        });
        this.locToLast();
        return this;
    };
    Line.prototype.arc = function (_a) {
        var rx = _a.rx, _b = _a.ry, ry = _b === void 0 ? rx : _b, _c = _a.start, start = _c === void 0 ? 0 : _c, _d = _a.arc, arc = _d === void 0 ? Math.PI / 2 : _d, _e = _a.slices, slices = _e === void 0 ? 4 : _e, arcd = _a.arcd;
        if (arcd !== undefined)
            arc = arcd / 180 * Math.PI;
        var end = start + arc;
        this.move(-rx * Math.cos(start), -ry * Math.sin(start));
        for (var i = 1; i <= slices; i++) {
            var a = start + arc / slices * i;
            this.points.push([this.loc[0] + rx * Math.cos(a), this.loc[1] + ry * Math.sin(a)]);
        }
        this.locToLast();
        return this;
    };
    Line.rect = function (x, y) {
        if (y === void 0) { y = x; }
        return new Line(x, 0).line(0, y).line(-2 * x, 0).line(0, -2 * y).line(2 * x, 0);
    };
    Line.circle = function (rx, ry, slices) {
        if (ry === void 0) { ry = rx; }
        if (slices === void 0) { slices = 12; }
        return new Line(rx, 0).arc({ rx: rx, ry: ry, arcd: 360, slices: slices });
    };
    Line.prototype.shrink = function (ofs) {
        var sofs = Math.sqrt(ofs);
        var r = new Line();
        r.points = [];
        for (var i = 0; i < this.points.length; i++) {
            var v0 = new CSG.Vector(this.points.get(i)[0], this.points.get(i)[1], 0);
            var v1 = new CSG.Vector(this.points.get(i - 1)[0], this.points.get(i - 1)[1], 0);
            var v2 = new CSG.Vector(this.points.get(i + 1)[0], this.points.get(i + 1)[1], 0);
            var v10 = v1.minus(v0).unit();
            var v20 = v2.minus(v0).unit();
            var ov = v20.plus(v10).unit().times(sofs).plus(v0);
            r.points.push([ov.x, ov.y]);
        }
        r.locToLast();
        return r;
    };
    Line.prototype.scale = function (x, y) {
        y = y || x;
        this.points.forEach(function (v) {
            v[0] *= x;
            v[1] *= y;
        });
        this.locToLast();
        return this;
    };
    Line.prototype.toPolygon = function (_a) {
        var _b = _a === void 0 ? { z: 0 } : _a, _c = _b.z, z = _c === void 0 ? null : _c, _d = _b.x, x = _d === void 0 ? null : _d, _e = _b.y, y = _e === void 0 ? null : _e;
        var m;
        if (z != null)
            m = function (a) { return [a[0], a[1], z]; };
        else if (x != null)
            m = function (a) { return [x, a[0], a[1]]; };
        else if (y != null)
            m = function (a) { return [a[0], y, a[1]]; };
        else
            throw "no plane";
        var zs = this.points.map(function (p) { return m(p); });
        return poly.apply(void 0, zs);
    };
    return Line;
}());
exports.Line = Line;

},{"./csg.js":1,"./lightgl.js":2}],5:[function(require,module,exports){
var GL = require('./lightgl.js')

// Set the color of all polygons in this solid
CSG.prototype.setColor = function (r, g, b) {
  this.toPolygons().map(function (polygon) {
    polygon.shared = [r, g, b];
  });
};

// Convert from CSG solid to GL.Mesh object
CSG.prototype.toMesh = function () {
  var mesh = new GL.Mesh({ normals: true, colors: true });
  var indexer = new GL.Indexer();
  this.toPolygons().map(function (polygon) {
    var indices = polygon.vertices.map(function (vertex) {
      vertex.color = polygon.shared || [1, 1, 1];
      return indexer.add(vertex);
    });
    for (var i = 2; i < indices.length; i++) {
      mesh.triangles.push([indices[0], indices[i - 1], indices[i]]);
    }
  });
  mesh.vertices = indexer.unique.map(function (v) { return [v.pos.x, v.pos.y, v.pos.z]; });
  mesh.normals = indexer.unique.map(function (v) { return [v.normal.x, v.normal.y, v.normal.z]; });
  mesh.colors = indexer.unique.map(function (v) { return v.color; });
  mesh.computeWireframe();
  return mesh;
};

var viewers = [];

// Set to true so lines don't use the depth buffer
Viewer.lineOverlay = false;

// A viewer is a WebGL canvas that lets the user view a mesh. The user can
// tumble it around by dragging the mouse.
function Viewer(csg, width, height, depth) {
  viewers.push(this);

  var angleX = 20;
  var angleY = 20;

  // Get a new WebGL canvas
  var gl = GL.create();
  this.gl = gl;
  this.mesh = []
  if (Array.isArray(csg))
    csg.forEach(a => this.mesh.push(a.toMesh()));
  else this.mesh.push(csg.toMesh())
  // Set up the viewport
  gl.canvas.width = width;
  gl.canvas.height = height;
  gl.viewport(0, 0, width, height);
  gl.matrixMode(gl.PROJECTION);
  gl.loadIdentity();
  gl.perspective(45, width / height, 1, 5000);
  gl.matrixMode(gl.MODELVIEW);

  // Set up WebGL state
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.93, 0.93, 0.93, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.polygonOffset(1, 1);

  // Black shader for wireframe
  this.blackShader = new GL.Shader('\
    void main() {\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
    }\
  ', '\
    void main() {\
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.1);\
    }\
  ');

  // Shader with diffuse and specular lighting
  this.lightingShader = new GL.Shader('\
    varying vec3 color;\
    varying vec3 normal;\
    varying vec3 light;\
    void main() {\
      const vec3 lightDir = vec3(1.0, 2.0, 3.0) / 3.741657386773941;\
      light = (gl_ModelViewMatrix * vec4(lightDir, 0.0)).xyz;\
      color = gl_Color.rgb;\
      normal = gl_NormalMatrix * gl_Normal;\
      gl_Position = gl_ModelViewProjectionMatrix * gl_Vertex;\
    }\
  ', '\
    varying vec3 color;\
    varying vec3 normal;\
    varying vec3 light;\
    void main() {\
      vec3 n = normalize(normal);\
      float diffuse = max(0.0, dot(light, n));\
      float specular = pow(max(0.0, -reflect(light, n).z), 32.0) * sqrt(diffuse);\
      gl_FragColor = vec4(mix(color * (0.3 + 0.7 * diffuse), vec3(1.0), specular), 1.0);\
    }\
  ');

  gl.onmousemove = function (e) {
    if (e.dragging) {
      if (e.buttons == 1) {
        angleY += e.deltaX * 2;
        angleX += e.deltaY * 2;
        angleX = Math.max(-90, Math.min(90, angleX));
        that.gl.ondraw();
      }
      else if (e.buttons==2) {
        depth -= e.deltaY;
        that.gl.ondraw();

      }
    }
  };

  var that = this;
  gl.ondraw = function () {
    gl.makeCurrent();

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.loadIdentity();
    gl.translate(0, 0, -depth);
    gl.rotate(angleX, 1, 0, 0);
    gl.rotate(angleY, 0, 1, 0);

    if (!Viewer.lineOverlay) gl.enable(gl.POLYGON_OFFSET_FILL);

    that.mesh.forEach(m => that.lightingShader.draw(m, gl.TRIANGLES));
    if (!Viewer.lineOverlay) gl.disable(gl.POLYGON_OFFSET_FILL);

    if (Viewer.lineOverlay) gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    that.mesh.forEach(m => that.blackShader.draw(m, gl.LINES));
    gl.disable(gl.BLEND);
    if (Viewer.lineOverlay) gl.enable(gl.DEPTH_TEST);
  };

  gl.ondraw();
}

var nextID = 0;
Viewer.addViewer=function(viewer) {
  document.getElementById(nextID++).appendChild(viewer.gl.canvas);
}
module.exports = Viewer
},{"./lightgl.js":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL1VzZXJzL01hdHQvQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImNzZy5qcyIsImxpZ2h0Z2wuanMiLCJtYWluLmpzIiwibW9yZS5qcyIsInZpZXdlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2huQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLy8gQ29uc3RydWN0aXZlIFNvbGlkIEdlb21ldHJ5IChDU0cpIGlzIGEgbW9kZWxpbmcgdGVjaG5pcXVlIHRoYXQgdXNlcyBCb29sZWFuXHJcbi8vIG9wZXJhdGlvbnMgbGlrZSB1bmlvbiBhbmQgaW50ZXJzZWN0aW9uIHRvIGNvbWJpbmUgM0Qgc29saWRzLiBUaGlzIGxpYnJhcnlcclxuLy8gaW1wbGVtZW50cyBDU0cgb3BlcmF0aW9ucyBvbiBtZXNoZXMgZWxlZ2FudGx5IGFuZCBjb25jaXNlbHkgdXNpbmcgQlNQIHRyZWVzLFxyXG4vLyBhbmQgaXMgbWVhbnQgdG8gc2VydmUgYXMgYW4gZWFzaWx5IHVuZGVyc3RhbmRhYmxlIGltcGxlbWVudGF0aW9uIG9mIHRoZVxyXG4vLyBhbGdvcml0aG0uIEFsbCBlZGdlIGNhc2VzIGludm9sdmluZyBvdmVybGFwcGluZyBjb3BsYW5hciBwb2x5Z29ucyBpbiBib3RoXHJcbi8vIHNvbGlkcyBhcmUgY29ycmVjdGx5IGhhbmRsZWQuXHJcbi8vIFxyXG4vLyBFeGFtcGxlIHVzYWdlOlxyXG4vLyBcclxuLy8gICAgIHZhciBjdWJlID0gQ1NHLmN1YmUoKTtcclxuLy8gICAgIHZhciBzcGhlcmUgPSBDU0cuc3BoZXJlKHsgcmFkaXVzOiAxLjMgfSk7XHJcbi8vICAgICB2YXIgcG9seWdvbnMgPSBjdWJlLnN1YnRyYWN0KHNwaGVyZSkudG9Qb2x5Z29ucygpO1xyXG4vLyBcclxuLy8gIyMgSW1wbGVtZW50YXRpb24gRGV0YWlsc1xyXG4vLyBcclxuLy8gQWxsIENTRyBvcGVyYXRpb25zIGFyZSBpbXBsZW1lbnRlZCBpbiB0ZXJtcyBvZiB0d28gZnVuY3Rpb25zLCBgY2xpcFRvKClgIGFuZFxyXG4vLyBgaW52ZXJ0KClgLCB3aGljaCByZW1vdmUgcGFydHMgb2YgYSBCU1AgdHJlZSBpbnNpZGUgYW5vdGhlciBCU1AgdHJlZSBhbmQgc3dhcFxyXG4vLyBzb2xpZCBhbmQgZW1wdHkgc3BhY2UsIHJlc3BlY3RpdmVseS4gVG8gZmluZCB0aGUgdW5pb24gb2YgYGFgIGFuZCBgYmAsIHdlXHJcbi8vIHdhbnQgdG8gcmVtb3ZlIGV2ZXJ5dGhpbmcgaW4gYGFgIGluc2lkZSBgYmAgYW5kIGV2ZXJ5dGhpbmcgaW4gYGJgIGluc2lkZSBgYWAsXHJcbi8vIHRoZW4gY29tYmluZSBwb2x5Z29ucyBmcm9tIGBhYCBhbmQgYGJgIGludG8gb25lIHNvbGlkOlxyXG4vLyBcclxuLy8gICAgIGEuY2xpcFRvKGIpO1xyXG4vLyAgICAgYi5jbGlwVG8oYSk7XHJcbi8vICAgICBhLmJ1aWxkKGIuYWxsUG9seWdvbnMoKSk7XHJcbi8vIFxyXG4vLyBUaGUgb25seSB0cmlja3kgcGFydCBpcyBoYW5kbGluZyBvdmVybGFwcGluZyBjb3BsYW5hciBwb2x5Z29ucyBpbiBib3RoIHRyZWVzLlxyXG4vLyBUaGUgY29kZSBhYm92ZSBrZWVwcyBib3RoIGNvcGllcywgYnV0IHdlIG5lZWQgdG8ga2VlcCB0aGVtIGluIG9uZSB0cmVlIGFuZFxyXG4vLyByZW1vdmUgdGhlbSBpbiB0aGUgb3RoZXIgdHJlZS4gVG8gcmVtb3ZlIHRoZW0gZnJvbSBgYmAgd2UgY2FuIGNsaXAgdGhlXHJcbi8vIGludmVyc2Ugb2YgYGJgIGFnYWluc3QgYGFgLiBUaGUgY29kZSBmb3IgdW5pb24gbm93IGxvb2tzIGxpa2UgdGhpczpcclxuLy8gXHJcbi8vICAgICBhLmNsaXBUbyhiKTtcclxuLy8gICAgIGIuY2xpcFRvKGEpO1xyXG4vLyAgICAgYi5pbnZlcnQoKTtcclxuLy8gICAgIGIuY2xpcFRvKGEpO1xyXG4vLyAgICAgYi5pbnZlcnQoKTtcclxuLy8gICAgIGEuYnVpbGQoYi5hbGxQb2x5Z29ucygpKTtcclxuLy8gXHJcbi8vIFN1YnRyYWN0aW9uIGFuZCBpbnRlcnNlY3Rpb24gbmF0dXJhbGx5IGZvbGxvdyBmcm9tIHNldCBvcGVyYXRpb25zLiBJZlxyXG4vLyB1bmlvbiBpcyBgQSB8IEJgLCBzdWJ0cmFjdGlvbiBpcyBgQSAtIEIgPSB+KH5BIHwgQilgIGFuZCBpbnRlcnNlY3Rpb24gaXNcclxuLy8gYEEgJiBCID0gfih+QSB8IH5CKWAgd2hlcmUgYH5gIGlzIHRoZSBjb21wbGVtZW50IG9wZXJhdG9yLlxyXG4vLyBcclxuLy8gIyMgTGljZW5zZVxyXG4vLyBcclxuLy8gQ29weXJpZ2h0IChjKSAyMDExIEV2YW4gV2FsbGFjZSAoaHR0cDovL21hZGVieWV2YW4uY29tLyksIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cclxuXHJcbi8vICMgY2xhc3MgQ1NHXHJcblxyXG4vLyBIb2xkcyBhIGJpbmFyeSBzcGFjZSBwYXJ0aXRpb24gdHJlZSByZXByZXNlbnRpbmcgYSAzRCBzb2xpZC4gVHdvIHNvbGlkcyBjYW5cclxuLy8gYmUgY29tYmluZWQgdXNpbmcgdGhlIGB1bmlvbigpYCwgYHN1YnRyYWN0KClgLCBhbmQgYGludGVyc2VjdCgpYCBtZXRob2RzLlxyXG5cclxuQ1NHID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy5wb2x5Z29ucyA9IFtdO1xyXG59O1xyXG5cclxuLy8gQ29uc3RydWN0IGEgQ1NHIHNvbGlkIGZyb20gYSBsaXN0IG9mIGBDU0cuUG9seWdvbmAgaW5zdGFuY2VzLlxyXG5DU0cuZnJvbVBvbHlnb25zID0gZnVuY3Rpb24ocG9seWdvbnMpIHtcclxuICB2YXIgY3NnID0gbmV3IENTRygpO1xyXG4gIGNzZy5wb2x5Z29ucyA9IHBvbHlnb25zO1xyXG4gIHJldHVybiBjc2c7XHJcbn07XHJcblxyXG5DU0cucHJvdG90eXBlID0ge1xyXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciBjc2cgPSBuZXcgQ1NHKCk7XHJcbiAgICBjc2cucG9seWdvbnMgPSB0aGlzLnBvbHlnb25zLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLmNsb25lKCk7IH0pO1xyXG4gICAgcmV0dXJuIGNzZztcclxuICB9LFxyXG4gIHRvUG9seWdvbnM6IGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIHRoaXMucG9seWdvbnM7XHJcbiAgfSxcclxuICB0b1N0bDogZnVuY3Rpb24oKXtcclxuICAgIHZhciBzdGwgPSBcInNvbGlkIGJveFxcblwiO1xyXG4gICAgdGhpcy5wb2x5Z29ucy5mb3JFYWNoKHA9PntcclxuICAgICAgdmFyIHYgPSBwLnZlcnRpY2VzO1xyXG4gICAgICBmb3IgKHZhciBpID0gMjsgaSA8IHYubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBzdGwgKz0gXCJmYWNldCBub3JtYWwgXCIrcC5wbGFuZS5ub3JtYWwueCsnICcrcC5wbGFuZS5ub3JtYWwueSsnICcrcC5wbGFuZS5ub3JtYWwueisnXFxuJ1xyXG4gICAgICAgIHN0bCArPSBcIm91dGVyIGxvb3BcXG5cIjtcclxuICBcclxuICAgICAgICBzdGwrPVwidmVydGV4IFwiK3ZbMF0ucG9zLngrJyAnK3ZbMF0ucG9zLnkrJyAnK3ZbMF0ucG9zLnorJ1xcbic7XHJcbiAgICAgICAgc3RsKz1cInZlcnRleCBcIit2W2ktMV0ucG9zLngrJyAnK3ZbaS0xXS5wb3MueSsnICcrdltpLTFdLnBvcy56KydcXG4nO1xyXG4gICAgICAgIHN0bCs9XCJ2ZXJ0ZXggXCIrdltpXS5wb3MueCsnICcrdltpXS5wb3MueSsnICcrdltpXS5wb3MueisnXFxuJztcclxuXHJcbiAgICAgICAgc3RsICs9IFwiZW5kbG9vcFxcblwiO1xyXG4gICAgICAgIHN0bCArPSBcImVuZGZhY2V0XFxuXCI7XHJcblxyXG4gICAgICB9XHJcbiAgICAgIHN0bCArPSBcImVuZHNvbGlkIGJveFxcblwiO1xyXG4gICAgfSlcclxuICAgIHJldHVybiBzdGw7XHJcbiAgfSxcclxuICAvLyBSZXR1cm4gYSBuZXcgQ1NHIHNvbGlkIHJlcHJlc2VudGluZyBzcGFjZSBpbiBlaXRoZXIgdGhpcyBzb2xpZCBvciBpbiB0aGVcclxuICAvLyBzb2xpZCBgY3NnYC4gTmVpdGhlciB0aGlzIHNvbGlkIG5vciB0aGUgc29saWQgYGNzZ2AgYXJlIG1vZGlmaWVkLlxyXG4gIC8vIFxyXG4gIC8vICAgICBBLnVuaW9uKEIpXHJcbiAgLy8gXHJcbiAgLy8gICAgICstLS0tLS0tKyAgICAgICAgICAgICstLS0tLS0tK1xyXG4gIC8vICAgICB8ICAgICAgIHwgICAgICAgICAgICB8ICAgICAgIHxcclxuICAvLyAgICAgfCAgIEEgICB8ICAgICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgIHwgICAgKy0tKy0tLS0rICAgPSAgIHwgICAgICAgKy0tLS0rXHJcbiAgLy8gICAgICstLS0tKy0tKyAgICB8ICAgICAgICstLS0tKyAgICAgICB8XHJcbiAgLy8gICAgICAgICAgfCAgIEIgICB8ICAgICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgICAgICAgfCAgICAgICB8ICAgICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgICAgICAgKy0tLS0tLS0rICAgICAgICAgICAgKy0tLS0tLS0rXHJcbiAgLy8gXHJcbiAgdW5pb246IGZ1bmN0aW9uKGNzZykge1xyXG4gICAgdmFyIGEgPSBuZXcgQ1NHLk5vZGUodGhpcy5jbG9uZSgpLnBvbHlnb25zKTtcclxuICAgIHZhciBiID0gbmV3IENTRy5Ob2RlKGNzZy5jbG9uZSgpLnBvbHlnb25zKTtcclxuICAgIGEuY2xpcFRvKGIpO1xyXG4gICAgYi5jbGlwVG8oYSk7XHJcbiAgICBiLmludmVydCgpO1xyXG4gICAgYi5jbGlwVG8oYSk7XHJcbiAgICBiLmludmVydCgpO1xyXG4gICAgYS5idWlsZChiLmFsbFBvbHlnb25zKCkpO1xyXG4gICAgcmV0dXJuIENTRy5mcm9tUG9seWdvbnMoYS5hbGxQb2x5Z29ucygpKTtcclxuICB9LFxyXG5cclxuICAvLyBSZXR1cm4gYSBuZXcgQ1NHIHNvbGlkIHJlcHJlc2VudGluZyBzcGFjZSBpbiB0aGlzIHNvbGlkIGJ1dCBub3QgaW4gdGhlXHJcbiAgLy8gc29saWQgYGNzZ2AuIE5laXRoZXIgdGhpcyBzb2xpZCBub3IgdGhlIHNvbGlkIGBjc2dgIGFyZSBtb2RpZmllZC5cclxuICAvLyBcclxuICAvLyAgICAgQS5zdWJ0cmFjdChCKVxyXG4gIC8vIFxyXG4gIC8vICAgICArLS0tLS0tLSsgICAgICAgICAgICArLS0tLS0tLStcclxuICAvLyAgICAgfCAgICAgICB8ICAgICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgIHwgICBBICAgfCAgICAgICAgICAgIHwgICAgICAgfFxyXG4gIC8vICAgICB8ICAgICstLSstLS0tKyAgID0gICB8ICAgICstLStcclxuICAvLyAgICAgKy0tLS0rLS0rICAgIHwgICAgICAgKy0tLS0rXHJcbiAgLy8gICAgICAgICAgfCAgIEIgICB8XHJcbiAgLy8gICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgICAgICAgKy0tLS0tLS0rXHJcbiAgLy8gXHJcbiAgc3VidHJhY3Q6IGZ1bmN0aW9uKGNzZykge1xyXG4gICAgdmFyIGEgPSBuZXcgQ1NHLk5vZGUodGhpcy5jbG9uZSgpLnBvbHlnb25zKTtcclxuICAgIHZhciBiID0gbmV3IENTRy5Ob2RlKGNzZy5jbG9uZSgpLnBvbHlnb25zKTtcclxuICAgIGEuaW52ZXJ0KCk7XHJcbiAgICBhLmNsaXBUbyhiKTtcclxuICAgIGIuY2xpcFRvKGEpO1xyXG4gICAgYi5pbnZlcnQoKTtcclxuICAgIGIuY2xpcFRvKGEpO1xyXG4gICAgYi5pbnZlcnQoKTtcclxuICAgIGEuYnVpbGQoYi5hbGxQb2x5Z29ucygpKTtcclxuICAgIGEuaW52ZXJ0KCk7XHJcbiAgICByZXR1cm4gQ1NHLmZyb21Qb2x5Z29ucyhhLmFsbFBvbHlnb25zKCkpO1xyXG4gIH0sXHJcblxyXG4gIC8vIFJldHVybiBhIG5ldyBDU0cgc29saWQgcmVwcmVzZW50aW5nIHNwYWNlIGJvdGggdGhpcyBzb2xpZCBhbmQgaW4gdGhlXHJcbiAgLy8gc29saWQgYGNzZ2AuIE5laXRoZXIgdGhpcyBzb2xpZCBub3IgdGhlIHNvbGlkIGBjc2dgIGFyZSBtb2RpZmllZC5cclxuICAvLyBcclxuICAvLyAgICAgQS5pbnRlcnNlY3QoQilcclxuICAvLyBcclxuICAvLyAgICAgKy0tLS0tLS0rXHJcbiAgLy8gICAgIHwgICAgICAgfFxyXG4gIC8vICAgICB8ICAgQSAgIHxcclxuICAvLyAgICAgfCAgICArLS0rLS0tLSsgICA9ICAgKy0tK1xyXG4gIC8vICAgICArLS0tLSstLSsgICAgfCAgICAgICArLS0rXHJcbiAgLy8gICAgICAgICAgfCAgIEIgICB8XHJcbiAgLy8gICAgICAgICAgfCAgICAgICB8XHJcbiAgLy8gICAgICAgICAgKy0tLS0tLS0rXHJcbiAgLy8gXHJcbiAgaW50ZXJzZWN0OiBmdW5jdGlvbihjc2cpIHtcclxuICAgIHZhciBhID0gbmV3IENTRy5Ob2RlKHRoaXMuY2xvbmUoKS5wb2x5Z29ucyk7XHJcbiAgICB2YXIgYiA9IG5ldyBDU0cuTm9kZShjc2cuY2xvbmUoKS5wb2x5Z29ucyk7XHJcbiAgICBhLmludmVydCgpO1xyXG4gICAgYi5jbGlwVG8oYSk7XHJcbiAgICBiLmludmVydCgpO1xyXG4gICAgYS5jbGlwVG8oYik7XHJcbiAgICBiLmNsaXBUbyhhKTtcclxuICAgIGEuYnVpbGQoYi5hbGxQb2x5Z29ucygpKTtcclxuICAgIGEuaW52ZXJ0KCk7XHJcbiAgICByZXR1cm4gQ1NHLmZyb21Qb2x5Z29ucyhhLmFsbFBvbHlnb25zKCkpO1xyXG4gIH0sXHJcblxyXG4gIC8vIFJldHVybiBhIG5ldyBDU0cgc29saWQgd2l0aCBzb2xpZCBhbmQgZW1wdHkgc3BhY2Ugc3dpdGNoZWQuIFRoaXMgc29saWQgaXNcclxuICAvLyBub3QgbW9kaWZpZWQuXHJcbiAgaW52ZXJzZTogZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgY3NnID0gdGhpcy5jbG9uZSgpO1xyXG4gICAgY3NnLnBvbHlnb25zLm1hcChmdW5jdGlvbihwKSB7IHAuZmxpcCgpOyB9KTtcclxuICAgIHJldHVybiBjc2c7XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gQ29uc3RydWN0IGFuIGF4aXMtYWxpZ25lZCBzb2xpZCBjdWJvaWQuIE9wdGlvbmFsIHBhcmFtZXRlcnMgYXJlIGBjZW50ZXJgIGFuZFxyXG4vLyBgcmFkaXVzYCwgd2hpY2ggZGVmYXVsdCB0byBgWzAsIDAsIDBdYCBhbmQgYFsxLCAxLCAxXWAuIFRoZSByYWRpdXMgY2FuIGJlXHJcbi8vIHNwZWNpZmllZCB1c2luZyBhIHNpbmdsZSBudW1iZXIgb3IgYSBsaXN0IG9mIHRocmVlIG51bWJlcnMsIG9uZSBmb3IgZWFjaCBheGlzLlxyXG4vLyBcclxuLy8gRXhhbXBsZSBjb2RlOlxyXG4vLyBcclxuLy8gICAgIHZhciBjdWJlID0gQ1NHLmN1YmUoe1xyXG4vLyAgICAgICBjZW50ZXI6IFswLCAwLCAwXSxcclxuLy8gICAgICAgcmFkaXVzOiAxXHJcbi8vICAgICB9KTtcclxuQ1NHLmN1YmUgPSBmdW5jdGlvbihvcHRpb25zKSB7XHJcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XHJcbiAgdmFyIGMgPSBuZXcgQ1NHLlZlY3RvcihvcHRpb25zLmNlbnRlciB8fCBbMCwgMCwgMF0pO1xyXG4gIHZhciByID0gIW9wdGlvbnMucmFkaXVzID8gWzEsIDEsIDFdIDogb3B0aW9ucy5yYWRpdXMubGVuZ3RoID9cclxuICAgICAgICAgICBvcHRpb25zLnJhZGl1cyA6IFtvcHRpb25zLnJhZGl1cywgb3B0aW9ucy5yYWRpdXMsIG9wdGlvbnMucmFkaXVzXTtcclxuICByZXR1cm4gQ1NHLmZyb21Qb2x5Z29ucyhbXHJcbiAgICBbWzAsIDQsIDYsIDJdLCBbLTEsIDAsIDBdXSxcclxuICAgIFtbMSwgMywgNywgNV0sIFsrMSwgMCwgMF1dLFxyXG4gICAgW1swLCAxLCA1LCA0XSwgWzAsIC0xLCAwXV0sXHJcbiAgICBbWzIsIDYsIDcsIDNdLCBbMCwgKzEsIDBdXSxcclxuICAgIFtbMCwgMiwgMywgMV0sIFswLCAwLCAtMV1dLFxyXG4gICAgW1s0LCA1LCA3LCA2XSwgWzAsIDAsICsxXV1cclxuICBdLm1hcChmdW5jdGlvbihpbmZvKSB7XHJcbiAgICByZXR1cm4gbmV3IENTRy5Qb2x5Z29uKGluZm9bMF0ubWFwKGZ1bmN0aW9uKGkpIHtcclxuICAgICAgdmFyIHBvcyA9IG5ldyBDU0cuVmVjdG9yKFxyXG4gICAgICAgIGMueCArIHJbMF0gKiAoMiAqICEhKGkgJiAxKSAtIDEpLFxyXG4gICAgICAgIGMueSArIHJbMV0gKiAoMiAqICEhKGkgJiAyKSAtIDEpLFxyXG4gICAgICAgIGMueiArIHJbMl0gKiAoMiAqICEhKGkgJiA0KSAtIDEpXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiBuZXcgQ1NHLlZlcnRleChwb3MsIG5ldyBDU0cuVmVjdG9yKGluZm9bMV0pKTtcclxuICAgIH0pKTtcclxuICB9KSk7XHJcbn07XHJcblxyXG4vLyBDb25zdHJ1Y3QgYSBzb2xpZCBzcGhlcmUuIE9wdGlvbmFsIHBhcmFtZXRlcnMgYXJlIGBjZW50ZXJgLCBgcmFkaXVzYCxcclxuLy8gYHNsaWNlc2AsIGFuZCBgc3RhY2tzYCwgd2hpY2ggZGVmYXVsdCB0byBgWzAsIDAsIDBdYCwgYDFgLCBgMTZgLCBhbmQgYDhgLlxyXG4vLyBUaGUgYHNsaWNlc2AgYW5kIGBzdGFja3NgIHBhcmFtZXRlcnMgY29udHJvbCB0aGUgdGVzc2VsbGF0aW9uIGFsb25nIHRoZVxyXG4vLyBsb25naXR1ZGUgYW5kIGxhdGl0dWRlIGRpcmVjdGlvbnMuXHJcbi8vIFxyXG4vLyBFeGFtcGxlIHVzYWdlOlxyXG4vLyBcclxuLy8gICAgIHZhciBzcGhlcmUgPSBDU0cuc3BoZXJlKHtcclxuLy8gICAgICAgY2VudGVyOiBbMCwgMCwgMF0sXHJcbi8vICAgICAgIHJhZGl1czogMSxcclxuLy8gICAgICAgc2xpY2VzOiAxNixcclxuLy8gICAgICAgc3RhY2tzOiA4XHJcbi8vICAgICB9KTtcclxuQ1NHLnNwaGVyZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICB2YXIgYyA9IG5ldyBDU0cuVmVjdG9yKG9wdGlvbnMuY2VudGVyIHx8IFswLCAwLCAwXSk7XHJcbiAgdmFyIHIgPSBvcHRpb25zLnJhZGl1cyB8fCAxO1xyXG4gIHZhciBzbGljZXMgPSBvcHRpb25zLnNsaWNlcyB8fCAxNjtcclxuICB2YXIgc3RhY2tzID0gb3B0aW9ucy5zdGFja3MgfHwgODtcclxuICB2YXIgcG9seWdvbnMgPSBbXSwgdmVydGljZXM7XHJcbiAgZnVuY3Rpb24gdmVydGV4KHRoZXRhLCBwaGkpIHtcclxuICAgIHRoZXRhICo9IE1hdGguUEkgKiAyO1xyXG4gICAgcGhpICo9IE1hdGguUEk7XHJcbiAgICB2YXIgZGlyID0gbmV3IENTRy5WZWN0b3IoXHJcbiAgICAgIE1hdGguY29zKHRoZXRhKSAqIE1hdGguc2luKHBoaSksXHJcbiAgICAgIE1hdGguY29zKHBoaSksXHJcbiAgICAgIE1hdGguc2luKHRoZXRhKSAqIE1hdGguc2luKHBoaSlcclxuICAgICk7XHJcbiAgICB2ZXJ0aWNlcy5wdXNoKG5ldyBDU0cuVmVydGV4KGMucGx1cyhkaXIudGltZXMocikpLCBkaXIpKTtcclxuICB9XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZXM7IGkrKykge1xyXG4gICAgZm9yICh2YXIgaiA9IDA7IGogPCBzdGFja3M7IGorKykge1xyXG4gICAgICB2ZXJ0aWNlcyA9IFtdO1xyXG4gICAgICB2ZXJ0ZXgoaSAvIHNsaWNlcywgaiAvIHN0YWNrcyk7XHJcbiAgICAgIGlmIChqID4gMCkgdmVydGV4KChpICsgMSkgLyBzbGljZXMsIGogLyBzdGFja3MpO1xyXG4gICAgICBpZiAoaiA8IHN0YWNrcyAtIDEpIHZlcnRleCgoaSArIDEpIC8gc2xpY2VzLCAoaiArIDEpIC8gc3RhY2tzKTtcclxuICAgICAgdmVydGV4KGkgLyBzbGljZXMsIChqICsgMSkgLyBzdGFja3MpO1xyXG4gICAgICBwb2x5Z29ucy5wdXNoKG5ldyBDU0cuUG9seWdvbih2ZXJ0aWNlcykpO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gQ1NHLmZyb21Qb2x5Z29ucyhwb2x5Z29ucyk7XHJcbn07XHJcblxyXG4vLyBDb25zdHJ1Y3QgYSBzb2xpZCBjeWxpbmRlci4gT3B0aW9uYWwgcGFyYW1ldGVycyBhcmUgYHN0YXJ0YCwgYGVuZGAsXHJcbi8vIGByYWRpdXNgLCBhbmQgYHNsaWNlc2AsIHdoaWNoIGRlZmF1bHQgdG8gYFswLCAtMSwgMF1gLCBgWzAsIDEsIDBdYCwgYDFgLCBhbmRcclxuLy8gYDE2YC4gVGhlIGBzbGljZXNgIHBhcmFtZXRlciBjb250cm9scyB0aGUgdGVzc2VsbGF0aW9uLlxyXG4vLyBcclxuLy8gRXhhbXBsZSB1c2FnZTpcclxuLy8gXHJcbi8vICAgICB2YXIgY3lsaW5kZXIgPSBDU0cuY3lsaW5kZXIoe1xyXG4vLyAgICAgICBzdGFydDogWzAsIC0xLCAwXSxcclxuLy8gICAgICAgZW5kOiBbMCwgMSwgMF0sXHJcbi8vICAgICAgIHJhZGl1czogMSxcclxuLy8gICAgICAgc2xpY2VzOiAxNlxyXG4vLyAgICAgfSk7XHJcbkNTRy5jeWxpbmRlciA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcclxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcclxuICB2YXIgcyA9IG5ldyBDU0cuVmVjdG9yKG9wdGlvbnMuc3RhcnQgfHwgWzAsIC0xLCAwXSk7XHJcbiAgdmFyIGUgPSBuZXcgQ1NHLlZlY3RvcihvcHRpb25zLmVuZCB8fCBbMCwgMSwgMF0pO1xyXG4gIHZhciByYXkgPSBlLm1pbnVzKHMpO1xyXG4gIHZhciByID0gb3B0aW9ucy5yYWRpdXMgfHwgMTtcclxuICB2YXIgc2xpY2VzID0gb3B0aW9ucy5zbGljZXMgfHwgMTY7XHJcbiAgdmFyIGF4aXNaID0gcmF5LnVuaXQoKSwgaXNZID0gKE1hdGguYWJzKGF4aXNaLnkpID4gMC41KTtcclxuICB2YXIgYXhpc1ggPSBuZXcgQ1NHLlZlY3Rvcihpc1ksICFpc1ksIDApLmNyb3NzKGF4aXNaKS51bml0KCk7XHJcbiAgdmFyIGF4aXNZID0gYXhpc1guY3Jvc3MoYXhpc1opLnVuaXQoKTtcclxuICB2YXIgc3RhcnQgPSBuZXcgQ1NHLlZlcnRleChzLCBheGlzWi5uZWdhdGVkKCkpO1xyXG4gIHZhciBlbmQgPSBuZXcgQ1NHLlZlcnRleChlLCBheGlzWi51bml0KCkpO1xyXG4gIHZhciBwb2x5Z29ucyA9IFtdO1xyXG4gIGZ1bmN0aW9uIHBvaW50KHN0YWNrLCBzbGljZSwgbm9ybWFsQmxlbmQpIHtcclxuICAgIHZhciBhbmdsZSA9IHNsaWNlICogTWF0aC5QSSAqIDI7XHJcbiAgICB2YXIgb3V0ID0gYXhpc1gudGltZXMoTWF0aC5jb3MoYW5nbGUpKS5wbHVzKGF4aXNZLnRpbWVzKE1hdGguc2luKGFuZ2xlKSkpO1xyXG4gICAgdmFyIHBvcyA9IHMucGx1cyhyYXkudGltZXMoc3RhY2spKS5wbHVzKG91dC50aW1lcyhyKSk7XHJcbiAgICB2YXIgbm9ybWFsID0gb3V0LnRpbWVzKDEgLSBNYXRoLmFicyhub3JtYWxCbGVuZCkpLnBsdXMoYXhpc1oudGltZXMobm9ybWFsQmxlbmQpKTtcclxuICAgIHJldHVybiBuZXcgQ1NHLlZlcnRleChwb3MsIG5vcm1hbCk7XHJcbiAgfVxyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc2xpY2VzOyBpKyspIHtcclxuICAgIHZhciB0MCA9IGkgLyBzbGljZXMsIHQxID0gKGkgKyAxKSAvIHNsaWNlcztcclxuICAgIHBvbHlnb25zLnB1c2gobmV3IENTRy5Qb2x5Z29uKFtzdGFydCwgcG9pbnQoMCwgdDAsIC0xKSwgcG9pbnQoMCwgdDEsIC0xKV0pKTtcclxuICAgIHBvbHlnb25zLnB1c2gobmV3IENTRy5Qb2x5Z29uKFtwb2ludCgwLCB0MSwgMCksIHBvaW50KDAsIHQwLCAwKSwgcG9pbnQoMSwgdDAsIDApLCBwb2ludCgxLCB0MSwgMCldKSk7XHJcbiAgICBwb2x5Z29ucy5wdXNoKG5ldyBDU0cuUG9seWdvbihbZW5kLCBwb2ludCgxLCB0MSwgMSksIHBvaW50KDEsIHQwLCAxKV0pKTtcclxuICB9XHJcbiAgcmV0dXJuIENTRy5mcm9tUG9seWdvbnMocG9seWdvbnMpO1xyXG59O1xyXG5cclxuLy8gIyBjbGFzcyBWZWN0b3JcclxuXHJcbi8vIFJlcHJlc2VudHMgYSAzRCB2ZWN0b3IuXHJcbi8vIFxyXG4vLyBFeGFtcGxlIHVzYWdlOlxyXG4vLyBcclxuLy8gICAgIG5ldyBDU0cuVmVjdG9yKDEsIDIsIDMpO1xyXG4vLyAgICAgbmV3IENTRy5WZWN0b3IoWzEsIDIsIDNdKTtcclxuLy8gICAgIG5ldyBDU0cuVmVjdG9yKHsgeDogMSwgeTogMiwgejogMyB9KTtcclxuXHJcbkNTRy5WZWN0b3IgPSBmdW5jdGlvbih4LCB5LCB6KSB7XHJcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMykge1xyXG4gICAgdGhpcy54ID0geDtcclxuICAgIHRoaXMueSA9IHk7XHJcbiAgICB0aGlzLnogPSB6O1xyXG4gIH0gZWxzZSBpZiAoJ3gnIGluIHgpIHtcclxuICAgIHRoaXMueCA9IHgueDtcclxuICAgIHRoaXMueSA9IHgueTtcclxuICAgIHRoaXMueiA9IHguejtcclxuICB9IGVsc2Uge1xyXG4gICAgdGhpcy54ID0geFswXTtcclxuICAgIHRoaXMueSA9IHhbMV07XHJcbiAgICB0aGlzLnogPSB4WzJdO1xyXG4gIH1cclxufTtcclxuXHJcbkNTRy5WZWN0b3IucHJvdG90eXBlID0ge1xyXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiBuZXcgQ1NHLlZlY3Rvcih0aGlzLngsIHRoaXMueSwgdGhpcy56KTtcclxuICB9LFxyXG5cclxuICBuZWdhdGVkOiBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiBuZXcgQ1NHLlZlY3RvcigtdGhpcy54LCAtdGhpcy55LCAtdGhpcy56KTtcclxuICB9LFxyXG5cclxuICBwbHVzOiBmdW5jdGlvbihhKSB7XHJcbiAgICByZXR1cm4gbmV3IENTRy5WZWN0b3IodGhpcy54ICsgYS54LCB0aGlzLnkgKyBhLnksIHRoaXMueiArIGEueik7XHJcbiAgfSxcclxuXHJcbiAgbWludXM6IGZ1bmN0aW9uKGEpIHtcclxuICAgIHJldHVybiBuZXcgQ1NHLlZlY3Rvcih0aGlzLnggLSBhLngsIHRoaXMueSAtIGEueSwgdGhpcy56IC0gYS56KTtcclxuICB9LFxyXG5cclxuICB0aW1lczogZnVuY3Rpb24oYSkge1xyXG4gICAgcmV0dXJuIG5ldyBDU0cuVmVjdG9yKHRoaXMueCAqIGEsIHRoaXMueSAqIGEsIHRoaXMueiAqIGEpO1xyXG4gIH0sXHJcblxyXG4gIGRpdmlkZWRCeTogZnVuY3Rpb24oYSkge1xyXG4gICAgcmV0dXJuIG5ldyBDU0cuVmVjdG9yKHRoaXMueCAvIGEsIHRoaXMueSAvIGEsIHRoaXMueiAvIGEpO1xyXG4gIH0sXHJcblxyXG4gIGRvdDogZnVuY3Rpb24oYSkge1xyXG4gICAgcmV0dXJuIHRoaXMueCAqIGEueCArIHRoaXMueSAqIGEueSArIHRoaXMueiAqIGEuejtcclxuICB9LFxyXG5cclxuICBsZXJwOiBmdW5jdGlvbihhLCB0KSB7XHJcbiAgICByZXR1cm4gdGhpcy5wbHVzKGEubWludXModGhpcykudGltZXModCkpO1xyXG4gIH0sXHJcblxyXG4gIGxlbmd0aDogZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gTWF0aC5zcXJ0KHRoaXMuZG90KHRoaXMpKTtcclxuICB9LFxyXG5cclxuICB1bml0OiBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiB0aGlzLmRpdmlkZWRCeSh0aGlzLmxlbmd0aCgpKTtcclxuICB9LFxyXG5cclxuICBjcm9zczogZnVuY3Rpb24oYSkge1xyXG4gICAgcmV0dXJuIG5ldyBDU0cuVmVjdG9yKFxyXG4gICAgICB0aGlzLnkgKiBhLnogLSB0aGlzLnogKiBhLnksXHJcbiAgICAgIHRoaXMueiAqIGEueCAtIHRoaXMueCAqIGEueixcclxuICAgICAgdGhpcy54ICogYS55IC0gdGhpcy55ICogYS54XHJcbiAgICApO1xyXG4gIH1cclxufTtcclxuXHJcbi8vICMgY2xhc3MgVmVydGV4XHJcblxyXG4vLyBSZXByZXNlbnRzIGEgdmVydGV4IG9mIGEgcG9seWdvbi4gVXNlIHlvdXIgb3duIHZlcnRleCBjbGFzcyBpbnN0ZWFkIG9mIHRoaXNcclxuLy8gb25lIHRvIHByb3ZpZGUgYWRkaXRpb25hbCBmZWF0dXJlcyBsaWtlIHRleHR1cmUgY29vcmRpbmF0ZXMgYW5kIHZlcnRleFxyXG4vLyBjb2xvcnMuIEN1c3RvbSB2ZXJ0ZXggY2xhc3NlcyBuZWVkIHRvIHByb3ZpZGUgYSBgcG9zYCBwcm9wZXJ0eSBhbmQgYGNsb25lKClgLFxyXG4vLyBgZmxpcCgpYCwgYW5kIGBpbnRlcnBvbGF0ZSgpYCBtZXRob2RzIHRoYXQgYmVoYXZlIGFuYWxvZ291cyB0byB0aGUgb25lc1xyXG4vLyBkZWZpbmVkIGJ5IGBDU0cuVmVydGV4YC4gVGhpcyBjbGFzcyBwcm92aWRlcyBgbm9ybWFsYCBzbyBjb252ZW5pZW5jZVxyXG4vLyBmdW5jdGlvbnMgbGlrZSBgQ1NHLnNwaGVyZSgpYCBjYW4gcmV0dXJuIGEgc21vb3RoIHZlcnRleCBub3JtYWwsIGJ1dCBgbm9ybWFsYFxyXG4vLyBpcyBub3QgdXNlZCBhbnl3aGVyZSBlbHNlLlxyXG5cclxuQ1NHLlZlcnRleCA9IGZ1bmN0aW9uKHBvcywgbm9ybWFsKSB7XHJcbiAgdGhpcy5wb3MgPSBuZXcgQ1NHLlZlY3Rvcihwb3MpO1xyXG4gIHRoaXMubm9ybWFsID0gbmV3IENTRy5WZWN0b3Iobm9ybWFsKTtcclxufTtcclxuXHJcbkNTRy5WZXJ0ZXgucHJvdG90eXBlID0ge1xyXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcclxuICAgIHJldHVybiBuZXcgQ1NHLlZlcnRleCh0aGlzLnBvcy5jbG9uZSgpLCB0aGlzLm5vcm1hbC5jbG9uZSgpKTtcclxuICB9LFxyXG5cclxuICAvLyBJbnZlcnQgYWxsIG9yaWVudGF0aW9uLXNwZWNpZmljIGRhdGEgKGUuZy4gdmVydGV4IG5vcm1hbCkuIENhbGxlZCB3aGVuIHRoZVxyXG4gIC8vIG9yaWVudGF0aW9uIG9mIGEgcG9seWdvbiBpcyBmbGlwcGVkLlxyXG4gIGZsaXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5ub3JtYWwgPSB0aGlzLm5vcm1hbC5uZWdhdGVkKCk7XHJcbiAgfSxcclxuXHJcbiAgLy8gQ3JlYXRlIGEgbmV3IHZlcnRleCBiZXR3ZWVuIHRoaXMgdmVydGV4IGFuZCBgb3RoZXJgIGJ5IGxpbmVhcmx5XHJcbiAgLy8gaW50ZXJwb2xhdGluZyBhbGwgcHJvcGVydGllcyB1c2luZyBhIHBhcmFtZXRlciBvZiBgdGAuIFN1YmNsYXNzZXMgc2hvdWxkXHJcbiAgLy8gb3ZlcnJpZGUgdGhpcyB0byBpbnRlcnBvbGF0ZSBhZGRpdGlvbmFsIHByb3BlcnRpZXMuXHJcbiAgaW50ZXJwb2xhdGU6IGZ1bmN0aW9uKG90aGVyLCB0KSB7XHJcbiAgICByZXR1cm4gbmV3IENTRy5WZXJ0ZXgoXHJcbiAgICAgIHRoaXMucG9zLmxlcnAob3RoZXIucG9zLCB0KSxcclxuICAgICAgdGhpcy5ub3JtYWwubGVycChvdGhlci5ub3JtYWwsIHQpXHJcbiAgICApO1xyXG4gIH0sXHJcbiAgcm90YXRlOiBmdW5jdGlvbihtKSB7XHJcbiAgICB2YXIgcCA9IG0udHJhbnNmb3JtVmVjdG9yKHRoaXMucG9zKVxyXG4gICAgdmFyIG4gPSBtLnRyYW5zZm9ybVZlY3Rvcih0aGlzLm5vcm1hbCk7XHJcbiAgICByZXR1cm4gbmV3IENTRy5WZXJ0ZXgobmV3IENTRy5WZWN0b3IocC54LHAueSxwLnopLG5ldyBDU0cuVmVjdG9yKG4ueCxuLnksbi56KSlcclxuICB9XHJcbn07XHJcblxyXG4vLyAjIGNsYXNzIFBsYW5lXHJcblxyXG4vLyBSZXByZXNlbnRzIGEgcGxhbmUgaW4gM0Qgc3BhY2UuXHJcblxyXG5DU0cuUGxhbmUgPSBmdW5jdGlvbihub3JtYWwsIHcpIHtcclxuICB0aGlzLm5vcm1hbCA9IG5vcm1hbDtcclxuICB0aGlzLncgPSB3O1xyXG59O1xyXG5cclxuLy8gYENTRy5QbGFuZS5FUFNJTE9OYCBpcyB0aGUgdG9sZXJhbmNlIHVzZWQgYnkgYHNwbGl0UG9seWdvbigpYCB0byBkZWNpZGUgaWYgYVxyXG4vLyBwb2ludCBpcyBvbiB0aGUgcGxhbmUuXHJcbkNTRy5QbGFuZS5FUFNJTE9OID0gMWUtNTtcclxuXHJcbkNTRy5QbGFuZS5mcm9tUG9pbnRzID0gZnVuY3Rpb24oYSwgYiwgYykge1xyXG4gIHZhciBuID0gYi5taW51cyhhKS5jcm9zcyhjLm1pbnVzKGEpKS51bml0KCk7XHJcbiAgcmV0dXJuIG5ldyBDU0cuUGxhbmUobiwgbi5kb3QoYSkpO1xyXG59O1xyXG5cclxuQ1NHLlBsYW5lLnByb3RvdHlwZSA9IHtcclxuICBjbG9uZTogZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gbmV3IENTRy5QbGFuZSh0aGlzLm5vcm1hbC5jbG9uZSgpLCB0aGlzLncpO1xyXG4gIH0sXHJcblxyXG4gIGZsaXA6IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5ub3JtYWwgPSB0aGlzLm5vcm1hbC5uZWdhdGVkKCk7XHJcbiAgICB0aGlzLncgPSAtdGhpcy53O1xyXG4gIH0sXHJcblxyXG4gIC8vIFNwbGl0IGBwb2x5Z29uYCBieSB0aGlzIHBsYW5lIGlmIG5lZWRlZCwgdGhlbiBwdXQgdGhlIHBvbHlnb24gb3IgcG9seWdvblxyXG4gIC8vIGZyYWdtZW50cyBpbiB0aGUgYXBwcm9wcmlhdGUgbGlzdHMuIENvcGxhbmFyIHBvbHlnb25zIGdvIGludG8gZWl0aGVyXHJcbiAgLy8gYGNvcGxhbmFyRnJvbnRgIG9yIGBjb3BsYW5hckJhY2tgIGRlcGVuZGluZyBvbiB0aGVpciBvcmllbnRhdGlvbiB3aXRoXHJcbiAgLy8gcmVzcGVjdCB0byB0aGlzIHBsYW5lLiBQb2x5Z29ucyBpbiBmcm9udCBvciBpbiBiYWNrIG9mIHRoaXMgcGxhbmUgZ28gaW50b1xyXG4gIC8vIGVpdGhlciBgZnJvbnRgIG9yIGBiYWNrYC5cclxuICBzcGxpdFBvbHlnb246IGZ1bmN0aW9uKHBvbHlnb24sIGNvcGxhbmFyRnJvbnQsIGNvcGxhbmFyQmFjaywgZnJvbnQsIGJhY2spIHtcclxuICAgIHZhciBDT1BMQU5BUiA9IDA7XHJcbiAgICB2YXIgRlJPTlQgPSAxO1xyXG4gICAgdmFyIEJBQ0sgPSAyO1xyXG4gICAgdmFyIFNQQU5OSU5HID0gMztcclxuXHJcbiAgICAvLyBDbGFzc2lmeSBlYWNoIHBvaW50IGFzIHdlbGwgYXMgdGhlIGVudGlyZSBwb2x5Z29uIGludG8gb25lIG9mIHRoZSBhYm92ZVxyXG4gICAgLy8gZm91ciBjbGFzc2VzLlxyXG4gICAgdmFyIHBvbHlnb25UeXBlID0gMDtcclxuICAgIHZhciB0eXBlcyA9IFtdO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwb2x5Z29uLnZlcnRpY2VzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHZhciB0ID0gdGhpcy5ub3JtYWwuZG90KHBvbHlnb24udmVydGljZXNbaV0ucG9zKSAtIHRoaXMudztcclxuICAgICAgdmFyIHR5cGUgPSAodCA8IC1DU0cuUGxhbmUuRVBTSUxPTikgPyBCQUNLIDogKHQgPiBDU0cuUGxhbmUuRVBTSUxPTikgPyBGUk9OVCA6IENPUExBTkFSO1xyXG4gICAgICBwb2x5Z29uVHlwZSB8PSB0eXBlO1xyXG4gICAgICB0eXBlcy5wdXNoKHR5cGUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFB1dCB0aGUgcG9seWdvbiBpbiB0aGUgY29ycmVjdCBsaXN0LCBzcGxpdHRpbmcgaXQgd2hlbiBuZWNlc3NhcnkuXHJcbiAgICBzd2l0Y2ggKHBvbHlnb25UeXBlKSB7XHJcbiAgICAgIGNhc2UgQ09QTEFOQVI6XHJcbiAgICAgICAgKHRoaXMubm9ybWFsLmRvdChwb2x5Z29uLnBsYW5lLm5vcm1hbCkgPiAwID8gY29wbGFuYXJGcm9udCA6IGNvcGxhbmFyQmFjaykucHVzaChwb2x5Z29uKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSBGUk9OVDpcclxuICAgICAgICBmcm9udC5wdXNoKHBvbHlnb24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIEJBQ0s6XHJcbiAgICAgICAgYmFjay5wdXNoKHBvbHlnb24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBjYXNlIFNQQU5OSU5HOlxyXG4gICAgICAgIHZhciBmID0gW10sIGIgPSBbXTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvbHlnb24udmVydGljZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIHZhciBqID0gKGkgKyAxKSAlIHBvbHlnb24udmVydGljZXMubGVuZ3RoO1xyXG4gICAgICAgICAgdmFyIHRpID0gdHlwZXNbaV0sIHRqID0gdHlwZXNbal07XHJcbiAgICAgICAgICB2YXIgdmkgPSBwb2x5Z29uLnZlcnRpY2VzW2ldLCB2aiA9IHBvbHlnb24udmVydGljZXNbal07XHJcbiAgICAgICAgICBpZiAodGkgIT0gQkFDSykgZi5wdXNoKHZpKTtcclxuICAgICAgICAgIGlmICh0aSAhPSBGUk9OVCkgYi5wdXNoKHRpICE9IEJBQ0sgPyB2aS5jbG9uZSgpIDogdmkpO1xyXG4gICAgICAgICAgaWYgKCh0aSB8IHRqKSA9PSBTUEFOTklORykge1xyXG4gICAgICAgICAgICB2YXIgdCA9ICh0aGlzLncgLSB0aGlzLm5vcm1hbC5kb3QodmkucG9zKSkgLyB0aGlzLm5vcm1hbC5kb3QodmoucG9zLm1pbnVzKHZpLnBvcykpO1xyXG4gICAgICAgICAgICB2YXIgdiA9IHZpLmludGVycG9sYXRlKHZqLCB0KTtcclxuICAgICAgICAgICAgZi5wdXNoKHYpO1xyXG4gICAgICAgICAgICBiLnB1c2godi5jbG9uZSgpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGYubGVuZ3RoID49IDMpIGZyb250LnB1c2gobmV3IENTRy5Qb2x5Z29uKGYsIHBvbHlnb24uc2hhcmVkKSk7XHJcbiAgICAgICAgaWYgKGIubGVuZ3RoID49IDMpIGJhY2sucHVzaChuZXcgQ1NHLlBvbHlnb24oYiwgcG9seWdvbi5zaGFyZWQpKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcbn07XHJcblxyXG4vLyAjIGNsYXNzIFBvbHlnb25cclxuXHJcbi8vIFJlcHJlc2VudHMgYSBjb252ZXggcG9seWdvbi4gVGhlIHZlcnRpY2VzIHVzZWQgdG8gaW5pdGlhbGl6ZSBhIHBvbHlnb24gbXVzdFxyXG4vLyBiZSBjb3BsYW5hciBhbmQgZm9ybSBhIGNvbnZleCBsb29wLiBUaGV5IGRvIG5vdCBoYXZlIHRvIGJlIGBDU0cuVmVydGV4YFxyXG4vLyBpbnN0YW5jZXMgYnV0IHRoZXkgbXVzdCBiZWhhdmUgc2ltaWxhcmx5IChkdWNrIHR5cGluZyBjYW4gYmUgdXNlZCBmb3JcclxuLy8gY3VzdG9taXphdGlvbikuXHJcbi8vIFxyXG4vLyBFYWNoIGNvbnZleCBwb2x5Z29uIGhhcyBhIGBzaGFyZWRgIHByb3BlcnR5LCB3aGljaCBpcyBzaGFyZWQgYmV0d2VlbiBhbGxcclxuLy8gcG9seWdvbnMgdGhhdCBhcmUgY2xvbmVzIG9mIGVhY2ggb3RoZXIgb3Igd2VyZSBzcGxpdCBmcm9tIHRoZSBzYW1lIHBvbHlnb24uXHJcbi8vIFRoaXMgY2FuIGJlIHVzZWQgdG8gZGVmaW5lIHBlci1wb2x5Z29uIHByb3BlcnRpZXMgKHN1Y2ggYXMgc3VyZmFjZSBjb2xvcikuXHJcblxyXG5DU0cuUG9seWdvbiA9IGZ1bmN0aW9uKHZlcnRpY2VzLCBzaGFyZWQpIHtcclxuICB0aGlzLnZlcnRpY2VzID0gdmVydGljZXM7XHJcbiAgdGhpcy5zaGFyZWQgPSBzaGFyZWQ7XHJcbiAgdGhpcy5wbGFuZSA9IENTRy5QbGFuZS5mcm9tUG9pbnRzKHZlcnRpY2VzWzBdLnBvcywgdmVydGljZXNbMV0ucG9zLCB2ZXJ0aWNlc1syXS5wb3MpO1xyXG59O1xyXG5cclxuQ1NHLlBvbHlnb24ucHJvdG90eXBlID0ge1xyXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciB2ZXJ0aWNlcyA9IHRoaXMudmVydGljZXMubWFwKGZ1bmN0aW9uKHYpIHsgcmV0dXJuIHYuY2xvbmUoKTsgfSk7XHJcbiAgICByZXR1cm4gbmV3IENTRy5Qb2x5Z29uKHZlcnRpY2VzLCB0aGlzLnNoYXJlZCk7XHJcbiAgfSxcclxuXHJcbiAgZmxpcDogZnVuY3Rpb24oKSB7XHJcbiAgICB0aGlzLnZlcnRpY2VzLnJldmVyc2UoKS5tYXAoZnVuY3Rpb24odikgeyB2LmZsaXAoKTsgfSk7XHJcbiAgICB0aGlzLnBsYW5lLmZsaXAoKTtcclxuICB9LFxyXG4gIHRyYW5zbGF0ZTogZnVuY3Rpb24oZCl7XHJcbiAgICB0aGlzLnZlcnRpY2VzLmZvckVhY2godiA9PiB2LnBvcz12LnBvcy5wbHVzKGQpKTtcclxuICAgIHRoaXMucGxhbmUudyA9IHRoaXMucGxhbmUubm9ybWFsLmRvdCh0aGlzLnZlcnRpY2VzWzBdKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxufTtcclxuXHJcbi8vICMgY2xhc3MgTm9kZVxyXG5cclxuLy8gSG9sZHMgYSBub2RlIGluIGEgQlNQIHRyZWUuIEEgQlNQIHRyZWUgaXMgYnVpbHQgZnJvbSBhIGNvbGxlY3Rpb24gb2YgcG9seWdvbnNcclxuLy8gYnkgcGlja2luZyBhIHBvbHlnb24gdG8gc3BsaXQgYWxvbmcuIFRoYXQgcG9seWdvbiAoYW5kIGFsbCBvdGhlciBjb3BsYW5hclxyXG4vLyBwb2x5Z29ucykgYXJlIGFkZGVkIGRpcmVjdGx5IHRvIHRoYXQgbm9kZSBhbmQgdGhlIG90aGVyIHBvbHlnb25zIGFyZSBhZGRlZCB0b1xyXG4vLyB0aGUgZnJvbnQgYW5kL29yIGJhY2sgc3VidHJlZXMuIFRoaXMgaXMgbm90IGEgbGVhZnkgQlNQIHRyZWUgc2luY2UgdGhlcmUgaXNcclxuLy8gbm8gZGlzdGluY3Rpb24gYmV0d2VlbiBpbnRlcm5hbCBhbmQgbGVhZiBub2Rlcy5cclxuXHJcbkNTRy5Ob2RlID0gZnVuY3Rpb24ocG9seWdvbnMpIHtcclxuICB0aGlzLnBsYW5lID0gbnVsbDtcclxuICB0aGlzLmZyb250ID0gbnVsbDtcclxuICB0aGlzLmJhY2sgPSBudWxsO1xyXG4gIHRoaXMucG9seWdvbnMgPSBbXTtcclxuICBpZiAocG9seWdvbnMpIHRoaXMuYnVpbGQocG9seWdvbnMpO1xyXG59O1xyXG5cclxuQ1NHLk5vZGUucHJvdG90eXBlID0ge1xyXG4gIGNsb25lOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciBub2RlID0gbmV3IENTRy5Ob2RlKCk7XHJcbiAgICBub2RlLnBsYW5lID0gdGhpcy5wbGFuZSAmJiB0aGlzLnBsYW5lLmNsb25lKCk7XHJcbiAgICBub2RlLmZyb250ID0gdGhpcy5mcm9udCAmJiB0aGlzLmZyb250LmNsb25lKCk7XHJcbiAgICBub2RlLmJhY2sgPSB0aGlzLmJhY2sgJiYgdGhpcy5iYWNrLmNsb25lKCk7XHJcbiAgICBub2RlLnBvbHlnb25zID0gdGhpcy5wb2x5Z29ucy5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gcC5jbG9uZSgpOyB9KTtcclxuICAgIHJldHVybiBub2RlO1xyXG4gIH0sXHJcblxyXG4gIC8vIENvbnZlcnQgc29saWQgc3BhY2UgdG8gZW1wdHkgc3BhY2UgYW5kIGVtcHR5IHNwYWNlIHRvIHNvbGlkIHNwYWNlLlxyXG4gIGludmVydDogZnVuY3Rpb24oKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMucG9seWdvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdGhpcy5wb2x5Z29uc1tpXS5mbGlwKCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnBsYW5lLmZsaXAoKTtcclxuICAgIGlmICh0aGlzLmZyb250KSB0aGlzLmZyb250LmludmVydCgpO1xyXG4gICAgaWYgKHRoaXMuYmFjaykgdGhpcy5iYWNrLmludmVydCgpO1xyXG4gICAgdmFyIHRlbXAgPSB0aGlzLmZyb250O1xyXG4gICAgdGhpcy5mcm9udCA9IHRoaXMuYmFjaztcclxuICAgIHRoaXMuYmFjayA9IHRlbXA7XHJcbiAgfSxcclxuXHJcbiAgLy8gUmVjdXJzaXZlbHkgcmVtb3ZlIGFsbCBwb2x5Z29ucyBpbiBgcG9seWdvbnNgIHRoYXQgYXJlIGluc2lkZSB0aGlzIEJTUFxyXG4gIC8vIHRyZWUuXHJcbiAgY2xpcFBvbHlnb25zOiBmdW5jdGlvbihwb2x5Z29ucykge1xyXG4gICAgaWYgKCF0aGlzLnBsYW5lKSByZXR1cm4gcG9seWdvbnMuc2xpY2UoKTtcclxuICAgIHZhciBmcm9udCA9IFtdLCBiYWNrID0gW107XHJcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHBvbHlnb25zLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIHRoaXMucGxhbmUuc3BsaXRQb2x5Z29uKHBvbHlnb25zW2ldLCBmcm9udCwgYmFjaywgZnJvbnQsIGJhY2spO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMuZnJvbnQpIGZyb250ID0gdGhpcy5mcm9udC5jbGlwUG9seWdvbnMoZnJvbnQpO1xyXG4gICAgaWYgKHRoaXMuYmFjaykgYmFjayA9IHRoaXMuYmFjay5jbGlwUG9seWdvbnMoYmFjayk7XHJcbiAgICBlbHNlIGJhY2sgPSBbXTtcclxuICAgIHJldHVybiBmcm9udC5jb25jYXQoYmFjayk7XHJcbiAgfSxcclxuXHJcbiAgLy8gUmVtb3ZlIGFsbCBwb2x5Z29ucyBpbiB0aGlzIEJTUCB0cmVlIHRoYXQgYXJlIGluc2lkZSB0aGUgb3RoZXIgQlNQIHRyZWVcclxuICAvLyBgYnNwYC5cclxuICBjbGlwVG86IGZ1bmN0aW9uKGJzcCkge1xyXG4gICAgdGhpcy5wb2x5Z29ucyA9IGJzcC5jbGlwUG9seWdvbnModGhpcy5wb2x5Z29ucyk7XHJcbiAgICBpZiAodGhpcy5mcm9udCkgdGhpcy5mcm9udC5jbGlwVG8oYnNwKTtcclxuICAgIGlmICh0aGlzLmJhY2spIHRoaXMuYmFjay5jbGlwVG8oYnNwKTtcclxuICB9LFxyXG5cclxuICAvLyBSZXR1cm4gYSBsaXN0IG9mIGFsbCBwb2x5Z29ucyBpbiB0aGlzIEJTUCB0cmVlLlxyXG4gIGFsbFBvbHlnb25zOiBmdW5jdGlvbigpIHtcclxuICAgIHZhciBwb2x5Z29ucyA9IHRoaXMucG9seWdvbnMuc2xpY2UoKTtcclxuICAgIGlmICh0aGlzLmZyb250KSBwb2x5Z29ucyA9IHBvbHlnb25zLmNvbmNhdCh0aGlzLmZyb250LmFsbFBvbHlnb25zKCkpO1xyXG4gICAgaWYgKHRoaXMuYmFjaykgcG9seWdvbnMgPSBwb2x5Z29ucy5jb25jYXQodGhpcy5iYWNrLmFsbFBvbHlnb25zKCkpO1xyXG4gICAgcmV0dXJuIHBvbHlnb25zO1xyXG4gIH0sXHJcblxyXG4gIC8vIEJ1aWxkIGEgQlNQIHRyZWUgb3V0IG9mIGBwb2x5Z29uc2AuIFdoZW4gY2FsbGVkIG9uIGFuIGV4aXN0aW5nIHRyZWUsIHRoZVxyXG4gIC8vIG5ldyBwb2x5Z29ucyBhcmUgZmlsdGVyZWQgZG93biB0byB0aGUgYm90dG9tIG9mIHRoZSB0cmVlIGFuZCBiZWNvbWUgbmV3XHJcbiAgLy8gbm9kZXMgdGhlcmUuIEVhY2ggc2V0IG9mIHBvbHlnb25zIGlzIHBhcnRpdGlvbmVkIHVzaW5nIHRoZSBmaXJzdCBwb2x5Z29uXHJcbiAgLy8gKG5vIGhldXJpc3RpYyBpcyB1c2VkIHRvIHBpY2sgYSBnb29kIHNwbGl0KS5cclxuICBidWlsZDogZnVuY3Rpb24ocG9seWdvbnMpIHtcclxuICAgIGlmICghcG9seWdvbnMubGVuZ3RoKSByZXR1cm47XHJcbiAgICBpZiAoIXRoaXMucGxhbmUpIHRoaXMucGxhbmUgPSBwb2x5Z29uc1swXS5wbGFuZS5jbG9uZSgpO1xyXG4gICAgdmFyIGZyb250ID0gW10sIGJhY2sgPSBbXTtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9seWdvbnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgdGhpcy5wbGFuZS5zcGxpdFBvbHlnb24ocG9seWdvbnNbaV0sIHRoaXMucG9seWdvbnMsIHRoaXMucG9seWdvbnMsIGZyb250LCBiYWNrKTtcclxuICAgIH1cclxuICAgIGlmIChmcm9udC5sZW5ndGgpIHtcclxuICAgICAgaWYgKCF0aGlzLmZyb250KSB0aGlzLmZyb250ID0gbmV3IENTRy5Ob2RlKCk7XHJcbiAgICAgIHRoaXMuZnJvbnQuYnVpbGQoZnJvbnQpO1xyXG4gICAgfVxyXG4gICAgaWYgKGJhY2subGVuZ3RoKSB7XHJcbiAgICAgIGlmICghdGhpcy5iYWNrKSB0aGlzLmJhY2sgPSBuZXcgQ1NHLk5vZGUoKTtcclxuICAgICAgdGhpcy5iYWNrLmJ1aWxkKGJhY2spO1xyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ1NHIiwiLypcclxuICogbGlnaHRnbC5qc1xyXG4gKiBodHRwOi8vZ2l0aHViLmNvbS9ldmFudy9saWdodGdsLmpzL1xyXG4gKlxyXG4gKiBDb3B5cmlnaHQgMjAxMSBFdmFuIFdhbGxhY2VcclxuICogUmVsZWFzZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlXHJcbiAqL1xyXG52YXIgR0w9ZnVuY3Rpb24oKXtmdW5jdGlvbiBGKGIpe3JldHVybns4OlwiQkFDS1NQQUNFXCIsOTpcIlRBQlwiLDEzOlwiRU5URVJcIiwxNjpcIlNISUZUXCIsMjc6XCJFU0NBUEVcIiwzMjpcIlNQQUNFXCIsMzc6XCJMRUZUXCIsMzg6XCJVUFwiLDM5OlwiUklHSFRcIiw0MDpcIkRPV05cIn1bYl18fCg2NTw9YiYmOTA+PWI/U3RyaW5nLmZyb21DaGFyQ29kZShiKTpudWxsKX1mdW5jdGlvbiBrKCl7dmFyIGI9QXJyYXkucHJvdG90eXBlLmNvbmNhdC5hcHBseShbXSxhcmd1bWVudHMpO2IubGVuZ3RofHwoYj1bMSwwLDAsMCwwLDEsMCwwLDAsMCwxLDAsMCwwLDAsMV0pO3RoaXMubT1HP25ldyBGbG9hdDMyQXJyYXkoYik6Yn1mdW5jdGlvbiB0KCl7dGhpcy51bmlxdWU9W107dGhpcy5pbmRpY2VzPVtdO3RoaXMubWFwPXt9fWZ1bmN0aW9uIHYoYixjKXt0aGlzLmJ1ZmZlcj1udWxsO3RoaXMudGFyZ2V0PWI7dGhpcy50eXBlPWM7dGhpcy5kYXRhPVtdfWZ1bmN0aW9uIG8oYil7Yj1ifHx7fTt0aGlzLnZlcnRleEJ1ZmZlcnM9XHJcbnt9O3RoaXMuaW5kZXhCdWZmZXJzPXt9O3RoaXMuYWRkVmVydGV4QnVmZmVyKFwidmVydGljZXNcIixcImdsX1ZlcnRleFwiKTtiLmNvb3JkcyYmdGhpcy5hZGRWZXJ0ZXhCdWZmZXIoXCJjb29yZHNcIixcImdsX1RleENvb3JkXCIpO2Iubm9ybWFscyYmdGhpcy5hZGRWZXJ0ZXhCdWZmZXIoXCJub3JtYWxzXCIsXCJnbF9Ob3JtYWxcIik7Yi5jb2xvcnMmJnRoaXMuYWRkVmVydGV4QnVmZmVyKFwiY29sb3JzXCIsXCJnbF9Db2xvclwiKTsoIShcInRyaWFuZ2xlc1wiaW4gYil8fGIudHJpYW5nbGVzKSYmdGhpcy5hZGRJbmRleEJ1ZmZlcihcInRyaWFuZ2xlc1wiKTtiLmxpbmVzJiZ0aGlzLmFkZEluZGV4QnVmZmVyKFwibGluZXNcIil9ZnVuY3Rpb24gSChiKXtyZXR1cm4gbmV3IGooMiooYiYxKS0xLChiJjIpLTEsKGImNCkvMi0xKX1mdW5jdGlvbiB1KGIsYyxhKXt0aGlzLnQ9YXJndW1lbnRzLmxlbmd0aD9iOk51bWJlci5NQVhfVkFMVUU7dGhpcy5oaXQ9Yzt0aGlzLm5vcm1hbD1hfWZ1bmN0aW9uIHIoKXt2YXIgYj1kLmdldFBhcmFtZXRlcihkLlZJRVdQT1JUKSxcclxuYz1kLm1vZGVsdmlld01hdHJpeC5tLGE9bmV3IGooY1swXSxjWzRdLGNbOF0pLGU9bmV3IGooY1sxXSxjWzVdLGNbOV0pLGY9bmV3IGooY1syXSxjWzZdLGNbMTBdKSxjPW5ldyBqKGNbM10sY1s3XSxjWzExXSk7dGhpcy5leWU9bmV3IGooLWMuZG90KGEpLC1jLmRvdChlKSwtYy5kb3QoZikpO2E9YlswXTtlPWErYlsyXTtmPWJbMV07Yz1mK2JbM107dGhpcy5yYXkwMD1kLnVuUHJvamVjdChhLGYsMSkuc3VidHJhY3QodGhpcy5leWUpO3RoaXMucmF5MTA9ZC51blByb2plY3QoZSxmLDEpLnN1YnRyYWN0KHRoaXMuZXllKTt0aGlzLnJheTAxPWQudW5Qcm9qZWN0KGEsYywxKS5zdWJ0cmFjdCh0aGlzLmV5ZSk7dGhpcy5yYXkxMT1kLnVuUHJvamVjdChlLGMsMSkuc3VidHJhY3QodGhpcy5leWUpO3RoaXMudmlld3BvcnQ9Yn1mdW5jdGlvbiB3KGIsYyxhKXtmb3IoO251bGwhPShyZXN1bHQ9Yi5leGVjKGMpKTspYShyZXN1bHQpfWZ1bmN0aW9uIEUoYixjKXtmdW5jdGlvbiBhKGEpe3ZhciBiPVxyXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZChhKTtyZXR1cm4gYj9iLnRleHQ6YX1mdW5jdGlvbiBlKGEsYil7dmFyIGM9e30sZD0vXigoXFxzKlxcL1xcLy4qXFxufFxccyojZXh0ZW5zaW9uLipcXG4pKylbXl0qJC8uZXhlYyhiKSxiPWQ/ZFsxXSthK2Iuc3Vic3RyKGRbMV0ubGVuZ3RoKTphK2I7dygvXFxiZ2xfXFx3K1xcYi9nLGEsZnVuY3Rpb24oYSl7YSBpbiBjfHwoYj1iLnJlcGxhY2UoUmVnRXhwKFwiXFxcXGJcIithK1wiXFxcXGJcIixcImdcIiksXCJfXCIrYSksY1thXT0hMCl9KTtyZXR1cm4gYn1mdW5jdGlvbiBmKGEsYil7dmFyIGM9ZC5jcmVhdGVTaGFkZXIoYSk7ZC5zaGFkZXJTb3VyY2UoYyxiKTtkLmNvbXBpbGVTaGFkZXIoYyk7aWYoIWQuZ2V0U2hhZGVyUGFyYW1ldGVyKGMsZC5DT01QSUxFX1NUQVRVUykpdGhyb3dcImNvbXBpbGUgZXJyb3I6IFwiK2QuZ2V0U2hhZGVySW5mb0xvZyhjKTtyZXR1cm4gY312YXIgYj1hKGIpLGM9YShjKSxpPWIrYyxoPXt9O3coL1xcYihnbF9bXjtdKilcXGI7L2csXCJ1bmlmb3JtIG1hdDMgZ2xfTm9ybWFsTWF0cml4O3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdNYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld01hdHJpeEludmVyc2U7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXhJbnZlcnNlO3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdQcm9qZWN0aW9uTWF0cml4SW52ZXJzZTtcIixcclxuZnVuY3Rpb24oYSl7YT1hWzFdO2lmKC0xIT1pLmluZGV4T2YoYSkpe3ZhciBiPWEucmVwbGFjZSgvW2Etel9dL2csXCJcIik7aFtiXT1cIl9cIithfX0pOy0xIT1pLmluZGV4T2YoXCJmdHJhbnNmb3JtXCIpJiYoaC5NVlBNPVwiX2dsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXhcIik7dGhpcy51c2VkTWF0cmljZXM9aDtiPWUoXCJ1bmlmb3JtIG1hdDMgZ2xfTm9ybWFsTWF0cml4O3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdNYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld01hdHJpeEludmVyc2U7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXhJbnZlcnNlO3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdQcm9qZWN0aW9uTWF0cml4SW52ZXJzZTthdHRyaWJ1dGUgdmVjNCBnbF9WZXJ0ZXg7YXR0cmlidXRlIHZlYzQgZ2xfVGV4Q29vcmQ7YXR0cmlidXRlIHZlYzMgZ2xfTm9ybWFsO2F0dHJpYnV0ZSB2ZWM0IGdsX0NvbG9yO3ZlYzQgZnRyYW5zZm9ybSgpe3JldHVybiBnbF9Nb2RlbFZpZXdQcm9qZWN0aW9uTWF0cml4KmdsX1ZlcnRleDt9XCIsXHJcbmIpO2M9ZShcInByZWNpc2lvbiBoaWdocCBmbG9hdDt1bmlmb3JtIG1hdDMgZ2xfTm9ybWFsTWF0cml4O3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdNYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXg7dW5pZm9ybSBtYXQ0IGdsX01vZGVsVmlld01hdHJpeEludmVyc2U7dW5pZm9ybSBtYXQ0IGdsX1Byb2plY3Rpb25NYXRyaXhJbnZlcnNlO3VuaWZvcm0gbWF0NCBnbF9Nb2RlbFZpZXdQcm9qZWN0aW9uTWF0cml4SW52ZXJzZTtcIixjKTt0aGlzLnByb2dyYW09ZC5jcmVhdGVQcm9ncmFtKCk7ZC5hdHRhY2hTaGFkZXIodGhpcy5wcm9ncmFtLGYoZC5WRVJURVhfU0hBREVSLGIpKTtkLmF0dGFjaFNoYWRlcih0aGlzLnByb2dyYW0sZihkLkZSQUdNRU5UX1NIQURFUixjKSk7ZC5saW5rUHJvZ3JhbSh0aGlzLnByb2dyYW0pO2lmKCFkLmdldFByb2dyYW1QYXJhbWV0ZXIodGhpcy5wcm9ncmFtLFxyXG5kLkxJTktfU1RBVFVTKSl0aHJvd1wibGluayBlcnJvcjogXCIrZC5nZXRQcm9ncmFtSW5mb0xvZyh0aGlzLnByb2dyYW0pO3RoaXMuYXR0cmlidXRlcz17fTt0aGlzLnVuaWZvcm1Mb2NhdGlvbnM9e307dmFyIGc9e307dygvdW5pZm9ybVxccytzYW1wbGVyKDFEfDJEfDNEfEN1YmUpXFxzKyhcXHcrKVxccyo7L2csYitjLGZ1bmN0aW9uKGEpe2dbYVsyXV09MX0pO3RoaXMuaXNTYW1wbGVyPWd9ZnVuY3Rpb24gcShiLGMsYSl7YT1hfHx7fTt0aGlzLmlkPWQuY3JlYXRlVGV4dHVyZSgpO3RoaXMud2lkdGg9Yjt0aGlzLmhlaWdodD1jO3RoaXMuZm9ybWF0PWEuZm9ybWF0fHxkLlJHQkE7dGhpcy50eXBlPWEudHlwZXx8ZC5VTlNJR05FRF9CWVRFO2QuYmluZFRleHR1cmUoZC5URVhUVVJFXzJELHRoaXMuaWQpO2QucGl4ZWxTdG9yZWkoZC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLDEpO2QudGV4UGFyYW1ldGVyaShkLlRFWFRVUkVfMkQsZC5URVhUVVJFX01BR19GSUxURVIsYS5maWx0ZXJ8fGEubWFnRmlsdGVyfHxcclxuZC5MSU5FQVIpO2QudGV4UGFyYW1ldGVyaShkLlRFWFRVUkVfMkQsZC5URVhUVVJFX01JTl9GSUxURVIsYS5maWx0ZXJ8fGEubWluRmlsdGVyfHxkLkxJTkVBUik7ZC50ZXhQYXJhbWV0ZXJpKGQuVEVYVFVSRV8yRCxkLlRFWFRVUkVfV1JBUF9TLGEud3JhcHx8YS53cmFwU3x8ZC5DTEFNUF9UT19FREdFKTtkLnRleFBhcmFtZXRlcmkoZC5URVhUVVJFXzJELGQuVEVYVFVSRV9XUkFQX1QsYS53cmFwfHxhLndyYXBUfHxkLkNMQU1QX1RPX0VER0UpO2QudGV4SW1hZ2UyRChkLlRFWFRVUkVfMkQsMCx0aGlzLmZvcm1hdCxiLGMsMCx0aGlzLmZvcm1hdCx0aGlzLnR5cGUsbnVsbCl9ZnVuY3Rpb24gaihiLGMsYSl7dGhpcy54PWJ8fDA7dGhpcy55PWN8fDA7dGhpcy56PWF8fDB9dmFyIGQscz17Y3JlYXRlOmZ1bmN0aW9uKGIpe3ZhciBiPWJ8fHt9LGM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtjLndpZHRoPTgwMDtjLmhlaWdodD02MDA7XCJhbHBoYVwiaW4gYnx8KGIuYWxwaGE9XHJcbiExKTt0cnl7ZD1jLmdldENvbnRleHQoXCJ3ZWJnbFwiLGIpfWNhdGNoKGEpe310cnl7ZD1kfHxjLmdldENvbnRleHQoXCJleHBlcmltZW50YWwtd2ViZ2xcIixiKX1jYXRjaChlKXt9aWYoIWQpdGhyb3dcIldlYkdMIG5vdCBzdXBwb3J0ZWRcIjtkLk1PREVMVklFVz1JfDE7ZC5QUk9KRUNUSU9OPUl8Mjt2YXIgZj1uZXcgayxpPW5ldyBrO2QubW9kZWx2aWV3TWF0cml4PW5ldyBrO2QucHJvamVjdGlvbk1hdHJpeD1uZXcgazt2YXIgaD1bXSxnPVtdLG4sbTtkLm1hdHJpeE1vZGU9ZnVuY3Rpb24oYSl7c3dpdGNoKGEpe2Nhc2UgZC5NT0RFTFZJRVc6bj1cIm1vZGVsdmlld01hdHJpeFwiO209aDticmVhaztjYXNlIGQuUFJPSkVDVElPTjpuPVwicHJvamVjdGlvbk1hdHJpeFwiO209ZzticmVhaztkZWZhdWx0OnRocm93XCJpbnZhbGlkIG1hdHJpeCBtb2RlIFwiK2E7fX07ZC5sb2FkSWRlbnRpdHk9ZnVuY3Rpb24oKXtrLmlkZW50aXR5KGRbbl0pfTtkLmxvYWRNYXRyaXg9ZnVuY3Rpb24oYSl7Zm9yKHZhciBhPVxyXG5hLm0sYj1kW25dLm0sYz0wO2M8MTY7YysrKWJbY109YVtjXX07ZC5tdWx0TWF0cml4PWZ1bmN0aW9uKGEpe2QubG9hZE1hdHJpeChrLm11bHRpcGx5KGRbbl0sYSxpKSl9O2QucGVyc3BlY3RpdmU9ZnVuY3Rpb24oYSxiLGMsZSl7ZC5tdWx0TWF0cml4KGsucGVyc3BlY3RpdmUoYSxiLGMsZSxmKSl9O2QuZnJ1c3R1bT1mdW5jdGlvbihhLGIsYyxlLGcsaSl7ZC5tdWx0TWF0cml4KGsuZnJ1c3R1bShhLGIsYyxlLGcsaSxmKSl9O2Qub3J0aG89ZnVuY3Rpb24oYSxiLGMsZSxnLGkpe2QubXVsdE1hdHJpeChrLm9ydGhvKGEsYixjLGUsZyxpLGYpKX07ZC5zY2FsZT1mdW5jdGlvbihhLGIsYyl7ZC5tdWx0TWF0cml4KGsuc2NhbGUoYSxiLGMsZikpfTtkLnRyYW5zbGF0ZT1mdW5jdGlvbihhLGIsYyl7ZC5tdWx0TWF0cml4KGsudHJhbnNsYXRlKGEsYixjLGYpKX07ZC5yb3RhdGU9ZnVuY3Rpb24oYSxiLGMsZSl7ZC5tdWx0TWF0cml4KGsucm90YXRlKGEsYixjLGUsZikpfTtkLmxvb2tBdD1cclxuZnVuY3Rpb24oYSxiLGMsZSxnLGksaCxqLGwpe2QubXVsdE1hdHJpeChrLmxvb2tBdChhLGIsYyxlLGcsaSxoLGosbCxmKSl9O2QucHVzaE1hdHJpeD1mdW5jdGlvbigpe20ucHVzaChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChkW25dLm0pKX07ZC5wb3BNYXRyaXg9ZnVuY3Rpb24oKXt2YXIgYT1tLnBvcCgpO2Rbbl0ubT1HP25ldyBGbG9hdDMyQXJyYXkoYSk6YX07ZC5wcm9qZWN0PWZ1bmN0aW9uKGEsYixjLGUsZixnKXtlPWV8fGQubW9kZWx2aWV3TWF0cml4O2Y9Znx8ZC5wcm9qZWN0aW9uTWF0cml4O2c9Z3x8ZC5nZXRQYXJhbWV0ZXIoZC5WSUVXUE9SVCk7YT1mLnRyYW5zZm9ybVBvaW50KGUudHJhbnNmb3JtUG9pbnQobmV3IGooYSxiLGMpKSk7cmV0dXJuIG5ldyBqKGdbMF0rZ1syXSooYS54KjAuNSswLjUpLGdbMV0rZ1szXSooYS55KjAuNSswLjUpLGEueiowLjUrMC41KX07ZC51blByb2plY3Q9ZnVuY3Rpb24oYSxiLGMsZSxnLGgpe2U9ZXx8ZC5tb2RlbHZpZXdNYXRyaXg7XHJcbmc9Z3x8ZC5wcm9qZWN0aW9uTWF0cml4O2g9aHx8ZC5nZXRQYXJhbWV0ZXIoZC5WSUVXUE9SVCk7YT1uZXcgaigoYS1oWzBdKS9oWzJdKjItMSwoYi1oWzFdKS9oWzNdKjItMSxjKjItMSk7cmV0dXJuIGsuaW52ZXJzZShrLm11bHRpcGx5KGcsZSxmKSxpKS50cmFuc2Zvcm1Qb2ludChhKX07ZC5tYXRyaXhNb2RlKGQuTU9ERUxWSUVXKTt2YXIgbD1uZXcgbyh7Y29vcmRzOiEwLGNvbG9yczohMCx0cmlhbmdsZXM6ITF9KSx5PS0xLHA9WzAsMCwwLDBdLHE9WzEsMSwxLDFdLHU9bmV3IEUoXCJ1bmlmb3JtIGZsb2F0IHBvaW50U2l6ZTt2YXJ5aW5nIHZlYzQgY29sb3I7dmFyeWluZyB2ZWM0IGNvb3JkO3ZvaWQgbWFpbigpe2NvbG9yPWdsX0NvbG9yO2Nvb3JkPWdsX1RleENvb3JkO2dsX1Bvc2l0aW9uPWdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXgqZ2xfVmVydGV4O2dsX1BvaW50U2l6ZT1wb2ludFNpemU7fVwiLFxyXG5cInVuaWZvcm0gc2FtcGxlcjJEIHRleHR1cmU7dW5pZm9ybSBmbG9hdCBwb2ludFNpemU7dW5pZm9ybSBib29sIHVzZVRleHR1cmU7dmFyeWluZyB2ZWM0IGNvbG9yO3ZhcnlpbmcgdmVjNCBjb29yZDt2b2lkIG1haW4oKXtnbF9GcmFnQ29sb3I9Y29sb3I7aWYodXNlVGV4dHVyZSlnbF9GcmFnQ29sb3IqPXRleHR1cmUyRCh0ZXh0dXJlLGNvb3JkLnh5KTt9XCIpO2QucG9pbnRTaXplPWZ1bmN0aW9uKGEpe3UudW5pZm9ybXMoe3BvaW50U2l6ZTphfSl9O2QuYmVnaW49ZnVuY3Rpb24oYSl7aWYoeSE9LTEpdGhyb3dcIm1pc21hdGNoZWQgZ2wuYmVnaW4oKSBhbmQgZ2wuZW5kKCkgY2FsbHNcIjt5PWE7bC5jb2xvcnM9W107bC5jb29yZHM9W107bC52ZXJ0aWNlcz1bXX07ZC5jb2xvcj1mdW5jdGlvbihhLGIsYyxlKXtxPWFyZ3VtZW50cy5sZW5ndGg9PTE/YS50b0FycmF5KCkuY29uY2F0KDEpOlxyXG5bYSxiLGMsZXx8MV19O2QudGV4Q29vcmQ9ZnVuY3Rpb24oYSxiKXtwPWFyZ3VtZW50cy5sZW5ndGg9PTE/YS50b0FycmF5KDIpOlthLGJdfTtkLnZlcnRleD1mdW5jdGlvbihhLGIsYyl7bC5jb2xvcnMucHVzaChxKTtsLmNvb3Jkcy5wdXNoKHApO2wudmVydGljZXMucHVzaChhcmd1bWVudHMubGVuZ3RoPT0xP2EudG9BcnJheSgpOlthLGIsY10pfTtkLmVuZD1mdW5jdGlvbigpe2lmKHk9PS0xKXRocm93XCJtaXNtYXRjaGVkIGdsLmJlZ2luKCkgYW5kIGdsLmVuZCgpIGNhbGxzXCI7bC5jb21waWxlKCk7dS51bmlmb3Jtcyh7dXNlVGV4dHVyZTohIWQuZ2V0UGFyYW1ldGVyKGQuVEVYVFVSRV9CSU5ESU5HXzJEKX0pLmRyYXcobCx5KTt5PS0xfTt2YXIgcj1mdW5jdGlvbigpe2Zvcih2YXIgYSBpbiB4KWlmKEIuY2FsbCh4LGEpJiZ4W2FdKXJldHVybiB0cnVlO3JldHVybiBmYWxzZX0scz1mdW5jdGlvbihhKXt2YXIgYj17fSxjO2ZvcihjIGluIGEpYltjXT10eXBlb2YgYVtjXT09XCJmdW5jdGlvblwiP1xyXG5mdW5jdGlvbihiKXtyZXR1cm4gZnVuY3Rpb24oKXtiLmFwcGx5KGEsYXJndW1lbnRzKX19KGFbY10pOmFbY107Yi5vcmlnaW5hbD1hO2IueD1iLnBhZ2VYO2IueT1iLnBhZ2VZO2ZvcihjPWQuY2FudmFzO2M7Yz1jLm9mZnNldFBhcmVudCl7Yi54PWIueC1jLm9mZnNldExlZnQ7Yi55PWIueS1jLm9mZnNldFRvcH1pZihEKXtiLmRlbHRhWD1iLngtdjtiLmRlbHRhWT1iLnktd31lbHNle2IuZGVsdGFYPTA7Yi5kZWx0YVk9MDtEPXRydWV9dj1iLng7dz1iLnk7Yi5kcmFnZ2luZz1yKCk7Yi5wcmV2ZW50RGVmYXVsdD1mdW5jdGlvbigpe2Iub3JpZ2luYWwucHJldmVudERlZmF1bHQoKX07Yi5zdG9wUHJvcGFnYXRpb249ZnVuY3Rpb24oKXtiLm9yaWdpbmFsLnN0b3BQcm9wYWdhdGlvbigpfTtyZXR1cm4gYn0sej1mdW5jdGlvbihhKXtkPXQ7YT1zKGEpO2lmKGQub25tb3VzZW1vdmUpZC5vbm1vdXNlbW92ZShhKTthLnByZXZlbnREZWZhdWx0KCl9LEE9ZnVuY3Rpb24oYSl7ZD10O3hbYS53aGljaF09XHJcbmZhbHNlO2lmKCFyKCkpe2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIix6KTtkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLEEpO2QuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIix6KTtkLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLEEpfWE9cyhhKTtpZihkLm9ubW91c2V1cClkLm9ubW91c2V1cChhKTthLnByZXZlbnREZWZhdWx0KCl9LGI9ZnVuY3Rpb24oKXtEPWZhbHNlfSx0PWQsdj0wLHc9MCx4PXt9LEQ9ITEsQj1PYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O2QuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWRvd25cIixmdW5jdGlvbihhKXtkPXQ7aWYoIXIoKSl7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLHopO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZXVwXCIsQSk7ZC5jYW52YXMucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLHopO1xyXG5kLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLEEpfXhbYS53aGljaF09dHJ1ZTthPXMoYSk7aWYoZC5vbm1vdXNlZG93bilkLm9ubW91c2Vkb3duKGEpO2EucHJldmVudERlZmF1bHQoKX0pO2QuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIix6KTtkLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLEEpO2QuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW92ZXJcIixiKTtkLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKFwibW91c2VvdXRcIixiKTtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiY29udGV4dG1lbnVcIixmdW5jdGlvbigpe3g9e307RD1mYWxzZX0pO3ZhciBDPWQ7ZC5tYWtlQ3VycmVudD1mdW5jdGlvbigpe2Q9Q307ZC5hbmltYXRlPWZ1bmN0aW9uKCl7ZnVuY3Rpb24gYSgpe2Q9ZTt2YXIgZj0obmV3IERhdGUpLmdldFRpbWUoKTtpZihkLm9udXBkYXRlKWQub251cGRhdGUoKGYtYykvMUUzKTtpZihkLm9uZHJhdylkLm9uZHJhdygpO1xyXG5iKGEpO2M9Zn12YXIgYj13aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lfHx3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lfHx3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lfHxmdW5jdGlvbihhKXtzZXRUaW1lb3V0KGEsMUUzLzYwKX0sYz0obmV3IERhdGUpLmdldFRpbWUoKSxlPWQ7YSgpfTtkLmZ1bGxzY3JlZW49ZnVuY3Rpb24oYSl7ZnVuY3Rpb24gYigpe2QuY2FudmFzLndpZHRoPXdpbmRvdy5pbm5lcldpZHRoLWUtZjtkLmNhbnZhcy5oZWlnaHQ9d2luZG93LmlubmVySGVpZ2h0LWMtZztkLnZpZXdwb3J0KDAsMCxkLmNhbnZhcy53aWR0aCxkLmNhbnZhcy5oZWlnaHQpO2lmKGEuY2FtZXJhfHwhKFwiY2FtZXJhXCJpbiBhKSl7ZC5tYXRyaXhNb2RlKGQuUFJPSkVDVElPTik7ZC5sb2FkSWRlbnRpdHkoKTtkLnBlcnNwZWN0aXZlKGEuZm92fHw0NSxkLmNhbnZhcy53aWR0aC9kLmNhbnZhcy5oZWlnaHQsYS5uZWFyfHwwLjEsYS5mYXJ8fDFFMyk7ZC5tYXRyaXhNb2RlKGQuTU9ERUxWSUVXKX1pZihkLm9uZHJhdylkLm9uZHJhdygpfVxyXG52YXIgYT1hfHx7fSxjPWEucGFkZGluZ1RvcHx8MCxlPWEucGFkZGluZ0xlZnR8fDAsZj1hLnBhZGRpbmdSaWdodHx8MCxnPWEucGFkZGluZ0JvdHRvbXx8MDtpZighZG9jdW1lbnQuYm9keSl0aHJvd1wiZG9jdW1lbnQuYm9keSBkb2Vzbid0IGV4aXN0IHlldCAoY2FsbCBnbC5mdWxsc2NyZWVuKCkgZnJvbSB3aW5kb3cub25sb2FkKCkgb3IgZnJvbSBpbnNpZGUgdGhlIDxib2R5PiB0YWcpXCI7ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkLmNhbnZhcyk7ZG9jdW1lbnQuYm9keS5zdHlsZS5vdmVyZmxvdz1cImhpZGRlblwiO2QuY2FudmFzLnN0eWxlLnBvc2l0aW9uPVwiYWJzb2x1dGVcIjtkLmNhbnZhcy5zdHlsZS5sZWZ0PWUrXCJweFwiO2QuY2FudmFzLnN0eWxlLnRvcD1jK1wicHhcIjt3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihcInJlc2l6ZVwiLGIpO2IoKX07cmV0dXJuIGR9LGtleXM6e30sTWF0cml4OmssSW5kZXhlcjp0LEJ1ZmZlcjp2LE1lc2g6byxIaXRUZXN0OnUsUmF5dHJhY2VyOnIsU2hhZGVyOkUsXHJcblRleHR1cmU6cSxWZWN0b3I6an07ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIixmdW5jdGlvbihiKXtpZighYi5hbHRLZXkmJiFiLmN0cmxLZXkmJiFiLm1ldGFLZXkpe3ZhciBjPUYoYi5rZXlDb2RlKTtjJiYocy5rZXlzW2NdPSEwKTtzLmtleXNbYi5rZXlDb2RlXT0hMH19KTtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIixmdW5jdGlvbihiKXtpZighYi5hbHRLZXkmJiFiLmN0cmxLZXkmJiFiLm1ldGFLZXkpe3ZhciBjPUYoYi5rZXlDb2RlKTtjJiYocy5rZXlzW2NdPSExKTtzLmtleXNbYi5rZXlDb2RlXT0hMX19KTt2YXIgST0zMDUzOTc3NjAsRz1cInVuZGVmaW5lZFwiIT10eXBlb2YgRmxvYXQzMkFycmF5O2sucHJvdG90eXBlPXtpbnZlcnNlOmZ1bmN0aW9uKCl7cmV0dXJuIGsuaW52ZXJzZSh0aGlzLG5ldyBrKX0sdHJhbnNwb3NlOmZ1bmN0aW9uKCl7cmV0dXJuIGsudHJhbnNwb3NlKHRoaXMsbmV3IGspfSxtdWx0aXBseTpmdW5jdGlvbihiKXtyZXR1cm4gay5tdWx0aXBseSh0aGlzLFxyXG5iLG5ldyBrKX0sdHJhbnNmb3JtUG9pbnQ6ZnVuY3Rpb24oYil7dmFyIGM9dGhpcy5tO3JldHVybihuZXcgaihjWzBdKmIueCtjWzFdKmIueStjWzJdKmIueitjWzNdLGNbNF0qYi54K2NbNV0qYi55K2NbNl0qYi56K2NbN10sY1s4XSpiLngrY1s5XSpiLnkrY1sxMF0qYi56K2NbMTFdKSkuZGl2aWRlKGNbMTJdKmIueCtjWzEzXSpiLnkrY1sxNF0qYi56K2NbMTVdKX0sdHJhbnNmb3JtVmVjdG9yOmZ1bmN0aW9uKGIpe3ZhciBjPXRoaXMubTtyZXR1cm4gbmV3IGooY1swXSpiLngrY1sxXSpiLnkrY1syXSpiLnosY1s0XSpiLngrY1s1XSpiLnkrY1s2XSpiLnosY1s4XSpiLngrY1s5XSpiLnkrY1sxMF0qYi56KX19O2suaW52ZXJzZT1mdW5jdGlvbihiLGMpe3ZhciBjPWN8fG5ldyBrLGE9Yi5tLGU9Yy5tO2VbMF09YVs1XSphWzEwXSphWzE1XS1hWzVdKmFbMTRdKmFbMTFdLWFbNl0qYVs5XSphWzE1XSthWzZdKmFbMTNdKmFbMTFdK2FbN10qYVs5XSphWzE0XS1hWzddKmFbMTNdKmFbMTBdO1xyXG5lWzFdPS1hWzFdKmFbMTBdKmFbMTVdK2FbMV0qYVsxNF0qYVsxMV0rYVsyXSphWzldKmFbMTVdLWFbMl0qYVsxM10qYVsxMV0tYVszXSphWzldKmFbMTRdK2FbM10qYVsxM10qYVsxMF07ZVsyXT1hWzFdKmFbNl0qYVsxNV0tYVsxXSphWzE0XSphWzddLWFbMl0qYVs1XSphWzE1XSthWzJdKmFbMTNdKmFbN10rYVszXSphWzVdKmFbMTRdLWFbM10qYVsxM10qYVs2XTtlWzNdPS1hWzFdKmFbNl0qYVsxMV0rYVsxXSphWzEwXSphWzddK2FbMl0qYVs1XSphWzExXS1hWzJdKmFbOV0qYVs3XS1hWzNdKmFbNV0qYVsxMF0rYVszXSphWzldKmFbNl07ZVs0XT0tYVs0XSphWzEwXSphWzE1XSthWzRdKmFbMTRdKmFbMTFdK2FbNl0qYVs4XSphWzE1XS1hWzZdKmFbMTJdKmFbMTFdLWFbN10qYVs4XSphWzE0XSthWzddKmFbMTJdKmFbMTBdO2VbNV09YVswXSphWzEwXSphWzE1XS1hWzBdKmFbMTRdKmFbMTFdLWFbMl0qYVs4XSphWzE1XSthWzJdKmFbMTJdKmFbMTFdK2FbM10qYVs4XSphWzE0XS1cclxuYVszXSphWzEyXSphWzEwXTtlWzZdPS1hWzBdKmFbNl0qYVsxNV0rYVswXSphWzE0XSphWzddK2FbMl0qYVs0XSphWzE1XS1hWzJdKmFbMTJdKmFbN10tYVszXSphWzRdKmFbMTRdK2FbM10qYVsxMl0qYVs2XTtlWzddPWFbMF0qYVs2XSphWzExXS1hWzBdKmFbMTBdKmFbN10tYVsyXSphWzRdKmFbMTFdK2FbMl0qYVs4XSphWzddK2FbM10qYVs0XSphWzEwXS1hWzNdKmFbOF0qYVs2XTtlWzhdPWFbNF0qYVs5XSphWzE1XS1hWzRdKmFbMTNdKmFbMTFdLWFbNV0qYVs4XSphWzE1XSthWzVdKmFbMTJdKmFbMTFdK2FbN10qYVs4XSphWzEzXS1hWzddKmFbMTJdKmFbOV07ZVs5XT0tYVswXSphWzldKmFbMTVdK2FbMF0qYVsxM10qYVsxMV0rYVsxXSphWzhdKmFbMTVdLWFbMV0qYVsxMl0qYVsxMV0tYVszXSphWzhdKmFbMTNdK2FbM10qYVsxMl0qYVs5XTtlWzEwXT1hWzBdKmFbNV0qYVsxNV0tYVswXSphWzEzXSphWzddLWFbMV0qYVs0XSphWzE1XSthWzFdKmFbMTJdKmFbN10rYVszXSphWzRdKlxyXG5hWzEzXS1hWzNdKmFbMTJdKmFbNV07ZVsxMV09LWFbMF0qYVs1XSphWzExXSthWzBdKmFbOV0qYVs3XSthWzFdKmFbNF0qYVsxMV0tYVsxXSphWzhdKmFbN10tYVszXSphWzRdKmFbOV0rYVszXSphWzhdKmFbNV07ZVsxMl09LWFbNF0qYVs5XSphWzE0XSthWzRdKmFbMTNdKmFbMTBdK2FbNV0qYVs4XSphWzE0XS1hWzVdKmFbMTJdKmFbMTBdLWFbNl0qYVs4XSphWzEzXSthWzZdKmFbMTJdKmFbOV07ZVsxM109YVswXSphWzldKmFbMTRdLWFbMF0qYVsxM10qYVsxMF0tYVsxXSphWzhdKmFbMTRdK2FbMV0qYVsxMl0qYVsxMF0rYVsyXSphWzhdKmFbMTNdLWFbMl0qYVsxMl0qYVs5XTtlWzE0XT0tYVswXSphWzVdKmFbMTRdK2FbMF0qYVsxM10qYVs2XSthWzFdKmFbNF0qYVsxNF0tYVsxXSphWzEyXSphWzZdLWFbMl0qYVs0XSphWzEzXSthWzJdKmFbMTJdKmFbNV07ZVsxNV09YVswXSphWzVdKmFbMTBdLWFbMF0qYVs5XSphWzZdLWFbMV0qYVs0XSphWzEwXSthWzFdKmFbOF0qYVs2XStcclxuYVsyXSphWzRdKmFbOV0tYVsyXSphWzhdKmFbNV07Zm9yKHZhciBhPWFbMF0qZVswXSthWzFdKmVbNF0rYVsyXSplWzhdK2FbM10qZVsxMl0sZD0wOzE2PmQ7ZCsrKWVbZF0vPWE7cmV0dXJuIGN9O2sudHJhbnNwb3NlPWZ1bmN0aW9uKGIsYyl7dmFyIGM9Y3x8bmV3IGssYT1iLm0sZT1jLm07ZVswXT1hWzBdO2VbMV09YVs0XTtlWzJdPWFbOF07ZVszXT1hWzEyXTtlWzRdPWFbMV07ZVs1XT1hWzVdO2VbNl09YVs5XTtlWzddPWFbMTNdO2VbOF09YVsyXTtlWzldPWFbNl07ZVsxMF09YVsxMF07ZVsxMV09YVsxNF07ZVsxMl09YVszXTtlWzEzXT1hWzddO2VbMTRdPWFbMTFdO2VbMTVdPWFbMTVdO3JldHVybiBjfTtrLm11bHRpcGx5PWZ1bmN0aW9uKGIsYyxhKXt2YXIgYT1hfHxuZXcgayxiPWIubSxjPWMubSxlPWEubTtlWzBdPWJbMF0qY1swXStiWzFdKmNbNF0rYlsyXSpjWzhdK2JbM10qY1sxMl07ZVsxXT1iWzBdKmNbMV0rYlsxXSpjWzVdK2JbMl0qY1s5XStiWzNdKmNbMTNdO2VbMl09XHJcbmJbMF0qY1syXStiWzFdKmNbNl0rYlsyXSpjWzEwXStiWzNdKmNbMTRdO2VbM109YlswXSpjWzNdK2JbMV0qY1s3XStiWzJdKmNbMTFdK2JbM10qY1sxNV07ZVs0XT1iWzRdKmNbMF0rYls1XSpjWzRdK2JbNl0qY1s4XStiWzddKmNbMTJdO2VbNV09Yls0XSpjWzFdK2JbNV0qY1s1XStiWzZdKmNbOV0rYls3XSpjWzEzXTtlWzZdPWJbNF0qY1syXStiWzVdKmNbNl0rYls2XSpjWzEwXStiWzddKmNbMTRdO2VbN109Yls0XSpjWzNdK2JbNV0qY1s3XStiWzZdKmNbMTFdK2JbN10qY1sxNV07ZVs4XT1iWzhdKmNbMF0rYls5XSpjWzRdK2JbMTBdKmNbOF0rYlsxMV0qY1sxMl07ZVs5XT1iWzhdKmNbMV0rYls5XSpjWzVdK2JbMTBdKmNbOV0rYlsxMV0qY1sxM107ZVsxMF09Yls4XSpjWzJdK2JbOV0qY1s2XStiWzEwXSpjWzEwXStiWzExXSpjWzE0XTtlWzExXT1iWzhdKmNbM10rYls5XSpjWzddK2JbMTBdKmNbMTFdK2JbMTFdKmNbMTVdO2VbMTJdPWJbMTJdKmNbMF0rYlsxM10qY1s0XStiWzE0XSpcclxuY1s4XStiWzE1XSpjWzEyXTtlWzEzXT1iWzEyXSpjWzFdK2JbMTNdKmNbNV0rYlsxNF0qY1s5XStiWzE1XSpjWzEzXTtlWzE0XT1iWzEyXSpjWzJdK2JbMTNdKmNbNl0rYlsxNF0qY1sxMF0rYlsxNV0qY1sxNF07ZVsxNV09YlsxMl0qY1szXStiWzEzXSpjWzddK2JbMTRdKmNbMTFdK2JbMTVdKmNbMTVdO3JldHVybiBhfTtrLmlkZW50aXR5PWZ1bmN0aW9uKGIpe3ZhciBiPWJ8fG5ldyBrLGM9Yi5tO2NbMF09Y1s1XT1jWzEwXT1jWzE1XT0xO2NbMV09Y1syXT1jWzNdPWNbNF09Y1s2XT1jWzddPWNbOF09Y1s5XT1jWzExXT1jWzEyXT1jWzEzXT1jWzE0XT0wO3JldHVybiBifTtrLnBlcnNwZWN0aXZlPWZ1bmN0aW9uKGIsYyxhLGUsZCl7Yj1NYXRoLnRhbihiKk1hdGguUEkvMzYwKSphO2MqPWI7cmV0dXJuIGsuZnJ1c3R1bSgtYyxjLC1iLGIsYSxlLGQpfTtrLmZydXN0dW09ZnVuY3Rpb24oYixjLGEsZSxkLGksaCl7dmFyIGg9aHx8bmV3IGssZz1oLm07Z1swXT0yKmQvKGMtYik7Z1sxXT1cclxuMDtnWzJdPShjK2IpLyhjLWIpO2dbM109MDtnWzRdPTA7Z1s1XT0yKmQvKGUtYSk7Z1s2XT0oZSthKS8oZS1hKTtnWzddPTA7Z1s4XT0wO2dbOV09MDtnWzEwXT0tKGkrZCkvKGktZCk7Z1sxMV09LTIqaSpkLyhpLWQpO2dbMTJdPTA7Z1sxM109MDtnWzE0XT0tMTtnWzE1XT0wO3JldHVybiBofTtrLm9ydGhvPWZ1bmN0aW9uKGIsYyxhLGUsZCxpLGgpe3ZhciBoPWh8fG5ldyBrLGc9aC5tO2dbMF09Mi8oYy1iKTtnWzFdPTA7Z1syXT0wO2dbM109LShjK2IpLyhjLWIpO2dbNF09MDtnWzVdPTIvKGUtYSk7Z1s2XT0wO2dbN109LShlK2EpLyhlLWEpO2dbOF09MDtnWzldPTA7Z1sxMF09LTIvKGktZCk7Z1sxMV09LShpK2QpLyhpLWQpO2dbMTJdPTA7Z1sxM109MDtnWzE0XT0wO2dbMTVdPTE7cmV0dXJuIGh9O2suc2NhbGU9ZnVuY3Rpb24oYixjLGEsZCl7dmFyIGQ9ZHx8bmV3IGssZj1kLm07ZlswXT1iO2ZbMV09MDtmWzJdPTA7ZlszXT0wO2ZbNF09MDtmWzVdPWM7Zls2XT0wO2ZbN109XHJcbjA7Zls4XT0wO2ZbOV09MDtmWzEwXT1hO2ZbMTFdPTA7ZlsxMl09MDtmWzEzXT0wO2ZbMTRdPTA7ZlsxNV09MTtyZXR1cm4gZH07ay50cmFuc2xhdGU9ZnVuY3Rpb24oYixjLGEsZCl7dmFyIGQ9ZHx8bmV3IGssZj1kLm07ZlswXT0xO2ZbMV09MDtmWzJdPTA7ZlszXT1iO2ZbNF09MDtmWzVdPTE7Zls2XT0wO2ZbN109YztmWzhdPTA7Zls5XT0wO2ZbMTBdPTE7ZlsxMV09YTtmWzEyXT0wO2ZbMTNdPTA7ZlsxNF09MDtmWzE1XT0xO3JldHVybiBkfTtrLnJvdGF0ZT1mdW5jdGlvbihiLGMsYSxkLGYpe2lmKCFifHwhYyYmIWEmJiFkKXJldHVybiBrLmlkZW50aXR5KGYpO3ZhciBmPWZ8fG5ldyBrLGk9Zi5tLGg9TWF0aC5zcXJ0KGMqYythKmErZCpkKSxiPWIqKE1hdGguUEkvMTgwKSxjPWMvaCxhPWEvaCxkPWQvaCxoPU1hdGguY29zKGIpLGI9TWF0aC5zaW4oYiksZz0xLWg7aVswXT1jKmMqZytoO2lbMV09YyphKmctZCpiO2lbMl09YypkKmcrYSpiO2lbM109MDtpWzRdPWEqYypnK2QqYjtcclxuaVs1XT1hKmEqZytoO2lbNl09YSpkKmctYypiO2lbN109MDtpWzhdPWQqYypnLWEqYjtpWzldPWQqYSpnK2MqYjtpWzEwXT1kKmQqZytoO2lbMTFdPTA7aVsxMl09MDtpWzEzXT0wO2lbMTRdPTA7aVsxNV09MTtyZXR1cm4gZn07ay5sb29rQXQ9ZnVuY3Rpb24oYixjLGEsZCxmLGksaCxnLG4sbSl7dmFyIG09bXx8bmV3IGssbD1tLm0sYj1uZXcgaihiLGMsYSksZD1uZXcgaihkLGYsaSksZz1uZXcgaihoLGcsbiksaD1iLnN1YnRyYWN0KGQpLnVuaXQoKSxnPWcuY3Jvc3MoaCkudW5pdCgpLG49aC5jcm9zcyhnKS51bml0KCk7bFswXT1nLng7bFsxXT1nLnk7bFsyXT1nLno7bFszXT0tZy5kb3QoYik7bFs0XT1uLng7bFs1XT1uLnk7bFs2XT1uLno7bFs3XT0tbi5kb3QoYik7bFs4XT1oLng7bFs5XT1oLnk7bFsxMF09aC56O2xbMTFdPS1oLmRvdChiKTtsWzEyXT0wO2xbMTNdPTA7bFsxNF09MDtsWzE1XT0xO3JldHVybiBtfTt0LnByb3RvdHlwZT17YWRkOmZ1bmN0aW9uKGIpe3ZhciBjPVxyXG5KU09OLnN0cmluZ2lmeShiKTtjIGluIHRoaXMubWFwfHwodGhpcy5tYXBbY109dGhpcy51bmlxdWUubGVuZ3RoLHRoaXMudW5pcXVlLnB1c2goYikpO3JldHVybiB0aGlzLm1hcFtjXX19O3YucHJvdG90eXBlPXtjb21waWxlOmZ1bmN0aW9uKGIpe2Zvcih2YXIgYz1bXSxhPTA7YTx0aGlzLmRhdGEubGVuZ3RoO2ErPTFFNCljPUFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoYyx0aGlzLmRhdGEuc2xpY2UoYSxhKzFFNCkpO2E9dGhpcy5kYXRhLmxlbmd0aD9jLmxlbmd0aC90aGlzLmRhdGEubGVuZ3RoOjA7aWYoYSE9TWF0aC5yb3VuZChhKSl0aHJvd1wiYnVmZmVyIGVsZW1lbnRzIG5vdCBvZiBjb25zaXN0ZW50IHNpemUsIGF2ZXJhZ2Ugc2l6ZSBpcyBcIithO3RoaXMuYnVmZmVyPXRoaXMuYnVmZmVyfHxkLmNyZWF0ZUJ1ZmZlcigpO3RoaXMuYnVmZmVyLmxlbmd0aD1jLmxlbmd0aDt0aGlzLmJ1ZmZlci5zcGFjaW5nPWE7ZC5iaW5kQnVmZmVyKHRoaXMudGFyZ2V0LHRoaXMuYnVmZmVyKTtcclxuZC5idWZmZXJEYXRhKHRoaXMudGFyZ2V0LG5ldyB0aGlzLnR5cGUoYyksYnx8ZC5TVEFUSUNfRFJBVyl9fTtvLnByb3RvdHlwZT17YWRkVmVydGV4QnVmZmVyOmZ1bmN0aW9uKGIsYyl7KHRoaXMudmVydGV4QnVmZmVyc1tjXT1uZXcgdihkLkFSUkFZX0JVRkZFUixGbG9hdDMyQXJyYXkpKS5uYW1lPWI7dGhpc1tiXT1bXX0sYWRkSW5kZXhCdWZmZXI6ZnVuY3Rpb24oYil7dGhpcy5pbmRleEJ1ZmZlcnNbYl09bmV3IHYoZC5FTEVNRU5UX0FSUkFZX0JVRkZFUixVaW50MTZBcnJheSk7dGhpc1tiXT1bXX0sY29tcGlsZTpmdW5jdGlvbigpe2Zvcih2YXIgYiBpbiB0aGlzLnZlcnRleEJ1ZmZlcnMpe3ZhciBjPXRoaXMudmVydGV4QnVmZmVyc1tiXTtjLmRhdGE9dGhpc1tjLm5hbWVdO2MuY29tcGlsZSgpfWZvcih2YXIgYSBpbiB0aGlzLmluZGV4QnVmZmVycyljPXRoaXMuaW5kZXhCdWZmZXJzW2FdLGMuZGF0YT10aGlzW2FdLGMuY29tcGlsZSgpfSx0cmFuc2Zvcm06ZnVuY3Rpb24oYil7dGhpcy52ZXJ0aWNlcz1cclxudGhpcy52ZXJ0aWNlcy5tYXAoZnVuY3Rpb24oYSl7cmV0dXJuIGIudHJhbnNmb3JtUG9pbnQoai5mcm9tQXJyYXkoYSkpLnRvQXJyYXkoKX0pO2lmKHRoaXMubm9ybWFscyl7dmFyIGM9Yi5pbnZlcnNlKCkudHJhbnNwb3NlKCk7dGhpcy5ub3JtYWxzPXRoaXMubm9ybWFscy5tYXAoZnVuY3Rpb24oYSl7cmV0dXJuIGMudHJhbnNmb3JtVmVjdG9yKGouZnJvbUFycmF5KGEpKS51bml0KCkudG9BcnJheSgpfSl9dGhpcy5jb21waWxlKCk7cmV0dXJuIHRoaXN9LGNvbXB1dGVOb3JtYWxzOmZ1bmN0aW9uKCl7dGhpcy5ub3JtYWxzfHx0aGlzLmFkZFZlcnRleEJ1ZmZlcihcIm5vcm1hbHNcIixcImdsX05vcm1hbFwiKTtmb3IodmFyIGI9MDtiPHRoaXMudmVydGljZXMubGVuZ3RoO2IrKyl0aGlzLm5vcm1hbHNbYl09bmV3IGo7Zm9yKGI9MDtiPHRoaXMudHJpYW5nbGVzLmxlbmd0aDtiKyspe3ZhciBjPXRoaXMudHJpYW5nbGVzW2JdLGE9ai5mcm9tQXJyYXkodGhpcy52ZXJ0aWNlc1tjWzBdXSksZD1cclxuai5mcm9tQXJyYXkodGhpcy52ZXJ0aWNlc1tjWzFdXSksZj1qLmZyb21BcnJheSh0aGlzLnZlcnRpY2VzW2NbMl1dKSxhPWQuc3VidHJhY3QoYSkuY3Jvc3MoZi5zdWJ0cmFjdChhKSkudW5pdCgpO3RoaXMubm9ybWFsc1tjWzBdXT10aGlzLm5vcm1hbHNbY1swXV0uYWRkKGEpO3RoaXMubm9ybWFsc1tjWzFdXT10aGlzLm5vcm1hbHNbY1sxXV0uYWRkKGEpO3RoaXMubm9ybWFsc1tjWzJdXT10aGlzLm5vcm1hbHNbY1syXV0uYWRkKGEpfWZvcihiPTA7Yjx0aGlzLnZlcnRpY2VzLmxlbmd0aDtiKyspdGhpcy5ub3JtYWxzW2JdPXRoaXMubm9ybWFsc1tiXS51bml0KCkudG9BcnJheSgpO3RoaXMuY29tcGlsZSgpO3JldHVybiB0aGlzfSxjb21wdXRlV2lyZWZyYW1lOmZ1bmN0aW9uKCl7Zm9yKHZhciBiPW5ldyB0LGM9MDtjPHRoaXMudHJpYW5nbGVzLmxlbmd0aDtjKyspZm9yKHZhciBhPXRoaXMudHJpYW5nbGVzW2NdLGQ9MDtkPGEubGVuZ3RoO2QrKyl7dmFyIGY9YVtkXSxpPWFbKGQrXHJcbjEpJWEubGVuZ3RoXTtiLmFkZChbTWF0aC5taW4oZixpKSxNYXRoLm1heChmLGkpXSl9dGhpcy5saW5lc3x8dGhpcy5hZGRJbmRleEJ1ZmZlcihcImxpbmVzXCIpO3RoaXMubGluZXM9Yi51bmlxdWU7dGhpcy5jb21waWxlKCk7cmV0dXJuIHRoaXN9LGdldEFBQkI6ZnVuY3Rpb24oKXt2YXIgYj17bWluOm5ldyBqKE51bWJlci5NQVhfVkFMVUUsTnVtYmVyLk1BWF9WQUxVRSxOdW1iZXIuTUFYX1ZBTFVFKX07Yi5tYXg9Yi5taW4ubmVnYXRpdmUoKTtmb3IodmFyIGM9MDtjPHRoaXMudmVydGljZXMubGVuZ3RoO2MrKyl7dmFyIGE9ai5mcm9tQXJyYXkodGhpcy52ZXJ0aWNlc1tjXSk7Yi5taW49ai5taW4oYi5taW4sYSk7Yi5tYXg9ai5tYXgoYi5tYXgsYSl9cmV0dXJuIGJ9LGdldEJvdW5kaW5nU3BoZXJlOmZ1bmN0aW9uKCl7Zm9yKHZhciBiPXRoaXMuZ2V0QUFCQigpLGI9e2NlbnRlcjpiLm1pbi5hZGQoYi5tYXgpLmRpdmlkZSgyKSxyYWRpdXM6MH0sYz0wO2M8dGhpcy52ZXJ0aWNlcy5sZW5ndGg7YysrKWIucmFkaXVzPVxyXG5NYXRoLm1heChiLnJhZGl1cyxqLmZyb21BcnJheSh0aGlzLnZlcnRpY2VzW2NdKS5zdWJ0cmFjdChiLmNlbnRlcikubGVuZ3RoKCkpO3JldHVybiBifX07by5wbGFuZT1mdW5jdGlvbihiKXt2YXIgYj1ifHx7fSxjPW5ldyBvKGIpO2RldGFpbFg9Yi5kZXRhaWxYfHxiLmRldGFpbHx8MTtkZXRhaWxZPWIuZGV0YWlsWXx8Yi5kZXRhaWx8fDE7Zm9yKGI9MDtiPD1kZXRhaWxZO2IrKylmb3IodmFyIGE9Yi9kZXRhaWxZLGQ9MDtkPD1kZXRhaWxYO2QrKyl7dmFyIGY9ZC9kZXRhaWxYO2MudmVydGljZXMucHVzaChbMipmLTEsMiphLTEsMF0pO2MuY29vcmRzJiZjLmNvb3Jkcy5wdXNoKFtmLGFdKTtjLm5vcm1hbHMmJmMubm9ybWFscy5wdXNoKFswLDAsMV0pO2Q8ZGV0YWlsWCYmYjxkZXRhaWxZJiYoZj1kK2IqKGRldGFpbFgrMSksYy50cmlhbmdsZXMucHVzaChbZixmKzEsZitkZXRhaWxYKzFdKSxjLnRyaWFuZ2xlcy5wdXNoKFtmK2RldGFpbFgrMSxmKzEsZitkZXRhaWxYKzJdKSl9Yy5jb21waWxlKCk7XHJcbnJldHVybiBjfTt2YXIgSj1bWzAsNCwyLDYsLTEsMCwwXSxbMSwzLDUsNywxLDAsMF0sWzAsMSw0LDUsMCwtMSwwXSxbMiw2LDMsNywwLDEsMF0sWzAsMiwxLDMsMCwwLC0xXSxbNCw1LDYsNywwLDAsMV1dO28uY3ViZT1mdW5jdGlvbihiKXtmb3IodmFyIGI9bmV3IG8oYiksYz0wO2M8Si5sZW5ndGg7YysrKXtmb3IodmFyIGE9SltjXSxkPTQqYyxmPTA7ND5mO2YrKyliLnZlcnRpY2VzLnB1c2goSChhW2ZdKS50b0FycmF5KCkpLGIuY29vcmRzJiZiLmNvb3Jkcy5wdXNoKFtmJjEsKGYmMikvMl0pLGIubm9ybWFscyYmYi5ub3JtYWxzLnB1c2goYS5zbGljZSg0LDcpKTtiLnRyaWFuZ2xlcy5wdXNoKFtkLGQrMSxkKzJdKTtiLnRyaWFuZ2xlcy5wdXNoKFtkKzIsZCsxLGQrM10pfWIuY29tcGlsZSgpO3JldHVybiBifTtvLnNwaGVyZT1mdW5jdGlvbihiKXt2YXIgYj1ifHx7fSxjPW5ldyBvKGIpLGE9bmV3IHQ7ZGV0YWlsPWIuZGV0YWlsfHw2O2ZvcihiPTA7OD5iO2IrKylmb3IodmFyIGQ9XHJcbkgoYiksZj0wPGQueCpkLnkqZC56LGk9W10saD0wO2g8PWRldGFpbDtoKyspe2Zvcih2YXIgZz0wO2grZzw9ZGV0YWlsO2crKyl7dmFyIGs9aC9kZXRhaWwsbT1nL2RldGFpbCxsPShkZXRhaWwtaC1nKS9kZXRhaWwsbT17dmVydGV4OihuZXcgaihrKyhrLWsqaykvMixtKyhtLW0qbSkvMixsKyhsLWwqbCkvMikpLnVuaXQoKS5tdWx0aXBseShkKS50b0FycmF5KCl9O2MuY29vcmRzJiYobS5jb29yZD0wPGQueT9bMS1rLGxdOltsLDEta10pO2kucHVzaChhLmFkZChtKSl9aWYoMDxoKWZvcihnPTA7aCtnPD1kZXRhaWw7ZysrKWs9KGgtMSkqKGRldGFpbCsxKSsoaC0xLShoLTEpKihoLTEpKS8yK2csbT1oKihkZXRhaWwrMSkrKGgtaCpoKS8yK2csYy50cmlhbmdsZXMucHVzaChmP1tpW2tdLGlbbV0saVtrKzFdXTpbaVtrXSxpW2srMV0saVttXV0pLGgrZzxkZXRhaWwmJmMudHJpYW5nbGVzLnB1c2goZj9baVttXSxpW20rMV0saVtrKzFdXTpbaVttXSxpW2srMV0saVttKzFdXSl9Yy52ZXJ0aWNlcz1cclxuYS51bmlxdWUubWFwKGZ1bmN0aW9uKGEpe3JldHVybiBhLnZlcnRleH0pO2MuY29vcmRzJiYoYy5jb29yZHM9YS51bmlxdWUubWFwKGZ1bmN0aW9uKGEpe3JldHVybiBhLmNvb3JkfSkpO2Mubm9ybWFscyYmKGMubm9ybWFscz1jLnZlcnRpY2VzKTtjLmNvbXBpbGUoKTtyZXR1cm4gY307by5sb2FkPWZ1bmN0aW9uKGIsYyl7Yz1jfHx7fTtcImNvb3Jkc1wiaW4gY3x8KGMuY29vcmRzPSEhYi5jb29yZHMpO1wibm9ybWFsc1wiaW4gY3x8KGMubm9ybWFscz0hIWIubm9ybWFscyk7XCJjb2xvcnNcImluIGN8fChjLmNvbG9ycz0hIWIuY29sb3JzKTtcInRyaWFuZ2xlc1wiaW4gY3x8KGMudHJpYW5nbGVzPSEhYi50cmlhbmdsZXMpO1wibGluZXNcImluIGN8fChjLmxpbmVzPSEhYi5saW5lcyk7dmFyIGE9bmV3IG8oYyk7YS52ZXJ0aWNlcz1iLnZlcnRpY2VzO2EuY29vcmRzJiYoYS5jb29yZHM9Yi5jb29yZHMpO2Eubm9ybWFscyYmKGEubm9ybWFscz1iLm5vcm1hbHMpO2EuY29sb3JzJiYoYS5jb2xvcnM9Yi5jb2xvcnMpO1xyXG5hLnRyaWFuZ2xlcyYmKGEudHJpYW5nbGVzPWIudHJpYW5nbGVzKTthLmxpbmVzJiYoYS5saW5lcz1iLmxpbmVzKTthLmNvbXBpbGUoKTtyZXR1cm4gYX07dS5wcm90b3R5cGU9e21lcmdlV2l0aDpmdW5jdGlvbihiKXswPGIudCYmYi50PHRoaXMudCYmKHRoaXMudD1iLnQsdGhpcy5oaXQ9Yi5oaXQsdGhpcy5ub3JtYWw9Yi5ub3JtYWwpfX07ci5wcm90b3R5cGU9e2dldFJheUZvclBpeGVsOmZ1bmN0aW9uKGIsYyl7dmFyIGI9KGItdGhpcy52aWV3cG9ydFswXSkvdGhpcy52aWV3cG9ydFsyXSxjPTEtKGMtdGhpcy52aWV3cG9ydFsxXSkvdGhpcy52aWV3cG9ydFszXSxhPWoubGVycCh0aGlzLnJheTAwLHRoaXMucmF5MTAsYiksZD1qLmxlcnAodGhpcy5yYXkwMSx0aGlzLnJheTExLGIpO3JldHVybiBqLmxlcnAoYSxkLGMpLnVuaXQoKX19O3IuaGl0VGVzdEJveD1mdW5jdGlvbihiLGMsYSxkKXt2YXIgZj1hLnN1YnRyYWN0KGIpLmRpdmlkZShjKSxpPWQuc3VidHJhY3QoYikuZGl2aWRlKGMpLFxyXG5oPWoubWluKGYsaSksZj1qLm1heChmLGkpLGg9aC5tYXgoKSxmPWYubWluKCk7cmV0dXJuIDA8aCYmaDxmPyhiPWIuYWRkKGMubXVsdGlwbHkoaCkpLGE9YS5hZGQoMUUtNiksZD1kLnN1YnRyYWN0KDFFLTYpLG5ldyB1KGgsYixuZXcgaigoYi54PmQueCktKGIueDxhLngpLChiLnk+ZC55KS0oYi55PGEueSksKGIuej5kLnopLShiLno8YS56KSkpKTpudWxsfTtyLmhpdFRlc3RTcGhlcmU9ZnVuY3Rpb24oYixjLGEsZCl7dmFyIGY9Yi5zdWJ0cmFjdChhKSxpPWMuZG90KGMpLGg9MipjLmRvdChmKSxmPWYuZG90KGYpLWQqZCxmPWgqaC00KmkqZjtyZXR1cm4gMDxmPyhpPSgtaC1NYXRoLnNxcnQoZikpLygyKmkpLGI9Yi5hZGQoYy5tdWx0aXBseShpKSksbmV3IHUoaSxiLGIuc3VidHJhY3QoYSkuZGl2aWRlKGQpKSk6bnVsbH07ci5oaXRUZXN0VHJpYW5nbGU9ZnVuY3Rpb24oYixjLGEsZCxmKXt2YXIgaT1kLnN1YnRyYWN0KGEpLGg9Zi5zdWJ0cmFjdChhKSxmPWkuY3Jvc3MoaCkudW5pdCgpLFxyXG5kPWYuZG90KGEuc3VidHJhY3QoYikpL2YuZG90KGMpO2lmKDA8ZCl7dmFyIGI9Yi5hZGQoYy5tdWx0aXBseShkKSksZz1iLnN1YnRyYWN0KGEpLGE9aC5kb3QoaCksYz1oLmRvdChpKSxoPWguZG90KGcpLGo9aS5kb3QoaSksaT1pLmRvdChnKSxnPWEqai1jKmMsaj0oaipoLWMqaSkvZyxpPShhKmktYypoKS9nO2lmKDA8PWomJjA8PWkmJjE+PWoraSlyZXR1cm4gbmV3IHUoZCxiLGYpfXJldHVybiBudWxsfTtuZXcgaztuZXcgaztFLnByb3RvdHlwZT17dW5pZm9ybXM6ZnVuY3Rpb24oYil7ZC51c2VQcm9ncmFtKHRoaXMucHJvZ3JhbSk7Zm9yKHZhciBjIGluIGIpe3ZhciBhPXRoaXMudW5pZm9ybUxvY2F0aW9uc1tjXXx8ZC5nZXRVbmlmb3JtTG9jYXRpb24odGhpcy5wcm9ncmFtLGMpO2lmKGEpe3RoaXMudW5pZm9ybUxvY2F0aW9uc1tjXT1hO3ZhciBlPWJbY107ZSBpbnN0YW5jZW9mIGo/ZT1bZS54LGUueSxlLnpdOmUgaW5zdGFuY2VvZiBrJiYoZT1lLm0pO3ZhciBmPU9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChlKTtcclxuaWYoXCJbb2JqZWN0IEFycmF5XVwiPT1mfHxcIltvYmplY3QgRmxvYXQzMkFycmF5XVwiPT1mKXN3aXRjaChlLmxlbmd0aCl7Y2FzZSAxOmQudW5pZm9ybTFmdihhLG5ldyBGbG9hdDMyQXJyYXkoZSkpO2JyZWFrO2Nhc2UgMjpkLnVuaWZvcm0yZnYoYSxuZXcgRmxvYXQzMkFycmF5KGUpKTticmVhaztjYXNlIDM6ZC51bmlmb3JtM2Z2KGEsbmV3IEZsb2F0MzJBcnJheShlKSk7YnJlYWs7Y2FzZSA0OmQudW5pZm9ybTRmdihhLG5ldyBGbG9hdDMyQXJyYXkoZSkpO2JyZWFrO2Nhc2UgOTpkLnVuaWZvcm1NYXRyaXgzZnYoYSwhMSxuZXcgRmxvYXQzMkFycmF5KFtlWzBdLGVbM10sZVs2XSxlWzFdLGVbNF0sZVs3XSxlWzJdLGVbNV0sZVs4XV0pKTticmVhaztjYXNlIDE2OmQudW5pZm9ybU1hdHJpeDRmdihhLCExLG5ldyBGbG9hdDMyQXJyYXkoW2VbMF0sZVs0XSxlWzhdLGVbMTJdLGVbMV0sZVs1XSxlWzldLGVbMTNdLGVbMl0sZVs2XSxlWzEwXSxlWzE0XSxlWzNdLGVbN10sZVsxMV0sZVsxNV1dKSk7XHJcbmJyZWFrO2RlZmF1bHQ6dGhyb3dcImRvbid0IGtub3cgaG93IHRvIGxvYWQgdW5pZm9ybSBcXFwiXCIrYysnXCIgb2YgbGVuZ3RoICcrZS5sZW5ndGg7fWVsc2UgaWYoZj1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoZSksXCJbb2JqZWN0IE51bWJlcl1cIj09Znx8XCJbb2JqZWN0IEJvb2xlYW5dXCI9PWYpKHRoaXMuaXNTYW1wbGVyW2NdP2QudW5pZm9ybTFpOmQudW5pZm9ybTFmKS5jYWxsKGQsYSxlKTtlbHNlIHRocm93J2F0dGVtcHRlZCB0byBzZXQgdW5pZm9ybSBcIicrYysnXCIgdG8gaW52YWxpZCB2YWx1ZSAnK2U7fX1yZXR1cm4gdGhpc30sZHJhdzpmdW5jdGlvbihiLGMpe3RoaXMuZHJhd0J1ZmZlcnMoYi52ZXJ0ZXhCdWZmZXJzLGIuaW5kZXhCdWZmZXJzW2M9PWQuTElORVM/XCJsaW5lc1wiOlwidHJpYW5nbGVzXCJdLDI+YXJndW1lbnRzLmxlbmd0aD9kLlRSSUFOR0xFUzpjKX0sZHJhd0J1ZmZlcnM6ZnVuY3Rpb24oYixjLGEpe3ZhciBlPXRoaXMudXNlZE1hdHJpY2VzLGY9ZC5tb2RlbHZpZXdNYXRyaXgsXHJcbmk9ZC5wcm9qZWN0aW9uTWF0cml4LGg9ZS5NVk1JfHxlLk5NP2YuaW52ZXJzZSgpOm51bGwsZz1lLlBNST9pLmludmVyc2UoKTpudWxsLGo9ZS5NVlBNfHxlLk1WUE1JP2kubXVsdGlwbHkoZik6bnVsbCxrPXt9O2UuTVZNJiYoa1tlLk1WTV09Zik7ZS5NVk1JJiYoa1tlLk1WTUldPWgpO2UuUE0mJihrW2UuUE1dPWkpO2UuUE1JJiYoa1tlLlBNSV09Zyk7ZS5NVlBNJiYoa1tlLk1WUE1dPWopO2UuTVZQTUkmJihrW2UuTVZQTUldPWouaW52ZXJzZSgpKTtlLk5NJiYoZj1oLm0sa1tlLk5NXT1bZlswXSxmWzRdLGZbOF0sZlsxXSxmWzVdLGZbOV0sZlsyXSxmWzZdLGZbMTBdXSk7dGhpcy51bmlmb3JtcyhrKTt2YXIgZT0wLGw7Zm9yKGwgaW4gYilrPWJbbF0sZj10aGlzLmF0dHJpYnV0ZXNbbF18fGQuZ2V0QXR0cmliTG9jYXRpb24odGhpcy5wcm9ncmFtLGwucmVwbGFjZSgvXmdsXy8sXCJfZ2xfXCIpKSwtMSE9ZiYmay5idWZmZXImJih0aGlzLmF0dHJpYnV0ZXNbbF09ZixkLmJpbmRCdWZmZXIoZC5BUlJBWV9CVUZGRVIsXHJcbmsuYnVmZmVyKSxkLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KGYpLGQudmVydGV4QXR0cmliUG9pbnRlcihmLGsuYnVmZmVyLnNwYWNpbmcsZC5GTE9BVCwhMSwwLDApLGU9ay5idWZmZXIubGVuZ3RoL2suYnVmZmVyLnNwYWNpbmcpO2ZvcihsIGluIHRoaXMuYXR0cmlidXRlcylsIGluIGJ8fGQuZGlzYWJsZVZlcnRleEF0dHJpYkFycmF5KHRoaXMuYXR0cmlidXRlc1tsXSk7aWYoZSYmKCFjfHxjLmJ1ZmZlcikpYz8oZC5iaW5kQnVmZmVyKGQuRUxFTUVOVF9BUlJBWV9CVUZGRVIsYy5idWZmZXIpLGQuZHJhd0VsZW1lbnRzKGEsYy5idWZmZXIubGVuZ3RoLGQuVU5TSUdORURfU0hPUlQsMCkpOmQuZHJhd0FycmF5cyhhLDAsZSk7cmV0dXJuIHRoaXN9fTt2YXIgQixwLEM7cS5wcm90b3R5cGU9e2JpbmQ6ZnVuY3Rpb24oYil7ZC5hY3RpdmVUZXh0dXJlKGQuVEVYVFVSRTArKGJ8fDApKTtkLmJpbmRUZXh0dXJlKGQuVEVYVFVSRV8yRCx0aGlzLmlkKX0sdW5iaW5kOmZ1bmN0aW9uKGIpe2QuYWN0aXZlVGV4dHVyZShkLlRFWFRVUkUwK1xyXG4oYnx8MCkpO2QuYmluZFRleHR1cmUoZC5URVhUVVJFXzJELG51bGwpfSxkcmF3VG86ZnVuY3Rpb24oYil7dmFyIGM9ZC5nZXRQYXJhbWV0ZXIoZC5WSUVXUE9SVCk7Qj1CfHxkLmNyZWF0ZUZyYW1lYnVmZmVyKCk7cD1wfHxkLmNyZWF0ZVJlbmRlcmJ1ZmZlcigpO2QuYmluZEZyYW1lYnVmZmVyKGQuRlJBTUVCVUZGRVIsQik7ZC5iaW5kUmVuZGVyYnVmZmVyKGQuUkVOREVSQlVGRkVSLHApO2lmKHRoaXMud2lkdGghPXAud2lkdGh8fHRoaXMuaGVpZ2h0IT1wLmhlaWdodClwLndpZHRoPXRoaXMud2lkdGgscC5oZWlnaHQ9dGhpcy5oZWlnaHQsZC5yZW5kZXJidWZmZXJTdG9yYWdlKGQuUkVOREVSQlVGRkVSLGQuREVQVEhfQ09NUE9ORU5UMTYsdGhpcy53aWR0aCx0aGlzLmhlaWdodCk7ZC5mcmFtZWJ1ZmZlclRleHR1cmUyRChkLkZSQU1FQlVGRkVSLGQuQ09MT1JfQVRUQUNITUVOVDAsZC5URVhUVVJFXzJELHRoaXMuaWQsMCk7ZC5mcmFtZWJ1ZmZlclJlbmRlcmJ1ZmZlcihkLkZSQU1FQlVGRkVSLFxyXG5kLkRFUFRIX0FUVEFDSE1FTlQsZC5SRU5ERVJCVUZGRVIscCk7ZC52aWV3cG9ydCgwLDAsdGhpcy53aWR0aCx0aGlzLmhlaWdodCk7YigpO2QuYmluZEZyYW1lYnVmZmVyKGQuRlJBTUVCVUZGRVIsbnVsbCk7ZC5iaW5kUmVuZGVyYnVmZmVyKGQuUkVOREVSQlVGRkVSLG51bGwpO2Qudmlld3BvcnQoY1swXSxjWzFdLGNbMl0sY1szXSl9LHN3YXBXaXRoOmZ1bmN0aW9uKGIpe3ZhciBjO2M9Yi5pZDtiLmlkPXRoaXMuaWQ7dGhpcy5pZD1jO2M9Yi53aWR0aDtiLndpZHRoPXRoaXMud2lkdGg7dGhpcy53aWR0aD1jO2M9Yi5oZWlnaHQ7Yi5oZWlnaHQ9dGhpcy5oZWlnaHQ7dGhpcy5oZWlnaHQ9Y319O3EuZnJvbUltYWdlPWZ1bmN0aW9uKGIsYyl7dmFyIGM9Y3x8e30sYT1uZXcgcShiLndpZHRoLGIuaGVpZ2h0LGMpO3RyeXtkLnRleEltYWdlMkQoZC5URVhUVVJFXzJELDAsYS5mb3JtYXQsYS5mb3JtYXQsYS50eXBlLGIpfWNhdGNoKGUpe2lmKFwiZmlsZTpcIj09bG9jYXRpb24ucHJvdG9jb2wpdGhyb3cnaW1hZ2Ugbm90IGxvYWRlZCBmb3Igc2VjdXJpdHkgcmVhc29ucyAoc2VydmUgdGhpcyBwYWdlIG92ZXIgXCJodHRwOi8vXCIgaW5zdGVhZCknO1xyXG50aHJvd1wiaW1hZ2Ugbm90IGxvYWRlZCBmb3Igc2VjdXJpdHkgcmVhc29ucyAoaW1hZ2UgbXVzdCBvcmlnaW5hdGUgZnJvbSB0aGUgc2FtZSBkb21haW4gYXMgdGhpcyBwYWdlIG9yIHVzZSBDcm9zcy1PcmlnaW4gUmVzb3VyY2UgU2hhcmluZylcIjt9Yy5taW5GaWx0ZXImJihjLm1pbkZpbHRlciE9ZC5ORUFSRVNUJiZjLm1pbkZpbHRlciE9ZC5MSU5FQVIpJiZkLmdlbmVyYXRlTWlwbWFwKGQuVEVYVFVSRV8yRCk7cmV0dXJuIGF9O3EuZnJvbVVSTD1mdW5jdGlvbihiLGMpe3ZhciBhO2lmKCEoYT1DKSl7YT1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiY2FudmFzXCIpLmdldENvbnRleHQoXCIyZFwiKTthLmNhbnZhcy53aWR0aD1hLmNhbnZhcy5oZWlnaHQ9MTI4O2Zvcih2YXIgZT0wO2U8YS5jYW52YXMuaGVpZ2h0O2UrPTE2KWZvcih2YXIgZj0wO2Y8YS5jYW52YXMud2lkdGg7Zis9MTYpYS5maWxsU3R5bGU9KGZeZSkmMTY/XCIjRkZGXCI6XCIjREREXCIsYS5maWxsUmVjdChmLGUsMTYsMTYpO2E9XHJcbmEuY2FudmFzfUM9YTt2YXIgaT1xLmZyb21JbWFnZShDLGMpLGg9bmV3IEltYWdlLGc9ZDtoLm9ubG9hZD1mdW5jdGlvbigpe2cubWFrZUN1cnJlbnQoKTtxLmZyb21JbWFnZShoLGMpLnN3YXBXaXRoKGkpfTtoLnNyYz1iO3JldHVybiBpfTtqLnByb3RvdHlwZT17bmVnYXRpdmU6ZnVuY3Rpb24oKXtyZXR1cm4gbmV3IGooLXRoaXMueCwtdGhpcy55LC10aGlzLnopfSxhZGQ6ZnVuY3Rpb24oYil7cmV0dXJuIGIgaW5zdGFuY2VvZiBqP25ldyBqKHRoaXMueCtiLngsdGhpcy55K2IueSx0aGlzLnorYi56KTpuZXcgaih0aGlzLngrYix0aGlzLnkrYix0aGlzLnorYil9LHN1YnRyYWN0OmZ1bmN0aW9uKGIpe3JldHVybiBiIGluc3RhbmNlb2Ygaj9uZXcgaih0aGlzLngtYi54LHRoaXMueS1iLnksdGhpcy56LWIueik6bmV3IGoodGhpcy54LWIsdGhpcy55LWIsdGhpcy56LWIpfSxtdWx0aXBseTpmdW5jdGlvbihiKXtyZXR1cm4gYiBpbnN0YW5jZW9mIGo/bmV3IGoodGhpcy54KmIueCx0aGlzLnkqXHJcbmIueSx0aGlzLnoqYi56KTpuZXcgaih0aGlzLngqYix0aGlzLnkqYix0aGlzLnoqYil9LGRpdmlkZTpmdW5jdGlvbihiKXtyZXR1cm4gYiBpbnN0YW5jZW9mIGo/bmV3IGoodGhpcy54L2IueCx0aGlzLnkvYi55LHRoaXMuei9iLnopOm5ldyBqKHRoaXMueC9iLHRoaXMueS9iLHRoaXMuei9iKX0sZXF1YWxzOmZ1bmN0aW9uKGIpe3JldHVybiB0aGlzLng9PWIueCYmdGhpcy55PT1iLnkmJnRoaXMuej09Yi56fSxkb3Q6ZnVuY3Rpb24oYil7cmV0dXJuIHRoaXMueCpiLngrdGhpcy55KmIueSt0aGlzLnoqYi56fSxjcm9zczpmdW5jdGlvbihiKXtyZXR1cm4gbmV3IGoodGhpcy55KmIuei10aGlzLnoqYi55LHRoaXMueipiLngtdGhpcy54KmIueix0aGlzLngqYi55LXRoaXMueSpiLngpfSxsZW5ndGg6ZnVuY3Rpb24oKXtyZXR1cm4gTWF0aC5zcXJ0KHRoaXMuZG90KHRoaXMpKX0sdW5pdDpmdW5jdGlvbigpe3JldHVybiB0aGlzLmRpdmlkZSh0aGlzLmxlbmd0aCgpKX0sbWluOmZ1bmN0aW9uKCl7cmV0dXJuIE1hdGgubWluKE1hdGgubWluKHRoaXMueCxcclxudGhpcy55KSx0aGlzLnopfSxtYXg6ZnVuY3Rpb24oKXtyZXR1cm4gTWF0aC5tYXgoTWF0aC5tYXgodGhpcy54LHRoaXMueSksdGhpcy56KX0sdG9BbmdsZXM6ZnVuY3Rpb24oKXtyZXR1cm57dGhldGE6TWF0aC5hdGFuMih0aGlzLnosdGhpcy54KSxwaGk6TWF0aC5hc2luKHRoaXMueS90aGlzLmxlbmd0aCgpKX19LHRvQXJyYXk6ZnVuY3Rpb24oYil7cmV0dXJuW3RoaXMueCx0aGlzLnksdGhpcy56XS5zbGljZSgwLGJ8fDMpfSxjbG9uZTpmdW5jdGlvbigpe3JldHVybiBuZXcgaih0aGlzLngsdGhpcy55LHRoaXMueil9LGluaXQ6ZnVuY3Rpb24oYixjLGEpe3RoaXMueD1iO3RoaXMueT1jO3RoaXMuej1hO3JldHVybiB0aGlzfX07ai5uZWdhdGl2ZT1mdW5jdGlvbihiLGMpe2MueD0tYi54O2MueT0tYi55O2Muej0tYi56O3JldHVybiBjfTtqLmFkZD1mdW5jdGlvbihiLGMsYSl7YyBpbnN0YW5jZW9mIGo/KGEueD1iLngrYy54LGEueT1iLnkrYy55LGEuej1iLnorYy56KTooYS54PWIueCtcclxuYyxhLnk9Yi55K2MsYS56PWIueitjKTtyZXR1cm4gYX07ai5zdWJ0cmFjdD1mdW5jdGlvbihiLGMsYSl7YyBpbnN0YW5jZW9mIGo/KGEueD1iLngtYy54LGEueT1iLnktYy55LGEuej1iLnotYy56KTooYS54PWIueC1jLGEueT1iLnktYyxhLno9Yi56LWMpO3JldHVybiBhfTtqLm11bHRpcGx5PWZ1bmN0aW9uKGIsYyxhKXtjIGluc3RhbmNlb2Ygaj8oYS54PWIueCpjLngsYS55PWIueSpjLnksYS56PWIueipjLnopOihhLng9Yi54KmMsYS55PWIueSpjLGEuej1iLnoqYyk7cmV0dXJuIGF9O2ouZGl2aWRlPWZ1bmN0aW9uKGIsYyxhKXtjIGluc3RhbmNlb2Ygaj8oYS54PWIueC9jLngsYS55PWIueS9jLnksYS56PWIuei9jLnopOihhLng9Yi54L2MsYS55PWIueS9jLGEuej1iLnovYyk7cmV0dXJuIGF9O2ouY3Jvc3M9ZnVuY3Rpb24oYixjLGEpe2EueD1iLnkqYy56LWIueipjLnk7YS55PWIueipjLngtYi54KmMuejthLno9Yi54KmMueS1iLnkqYy54O3JldHVybiBhfTtqLnVuaXQ9ZnVuY3Rpb24oYixcclxuYyl7dmFyIGE9Yi5sZW5ndGgoKTtjLng9Yi54L2E7Yy55PWIueS9hO2Muej1iLnovYTtyZXR1cm4gY307ai5mcm9tQW5nbGVzPWZ1bmN0aW9uKGIsYyl7cmV0dXJuIG5ldyBqKE1hdGguY29zKGIpKk1hdGguY29zKGMpLE1hdGguc2luKGMpLE1hdGguc2luKGIpKk1hdGguY29zKGMpKX07ai5yYW5kb21EaXJlY3Rpb249ZnVuY3Rpb24oKXtyZXR1cm4gai5mcm9tQW5nbGVzKDIqTWF0aC5yYW5kb20oKSpNYXRoLlBJLE1hdGguYXNpbigyKk1hdGgucmFuZG9tKCktMSkpfTtqLm1pbj1mdW5jdGlvbihiLGMpe3JldHVybiBuZXcgaihNYXRoLm1pbihiLngsYy54KSxNYXRoLm1pbihiLnksYy55KSxNYXRoLm1pbihiLnosYy56KSl9O2oubWF4PWZ1bmN0aW9uKGIsYyl7cmV0dXJuIG5ldyBqKE1hdGgubWF4KGIueCxjLngpLE1hdGgubWF4KGIueSxjLnkpLE1hdGgubWF4KGIueixjLnopKX07ai5sZXJwPWZ1bmN0aW9uKGIsYyxhKXtyZXR1cm4gYy5zdWJ0cmFjdChiKS5tdWx0aXBseShhKS5hZGQoYil9O1xyXG5qLmZyb21BcnJheT1mdW5jdGlvbihiKXtyZXR1cm4gbmV3IGooYlswXSxiWzFdLGJbMl0pfTtyZXR1cm4gc30oKTtcclxubW9kdWxlLmV4cG9ydHMgPSBHTDsiLCJcInVzZSBzdHJpY3RcIjtcclxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7IHZhbHVlOiB0cnVlIH0pO1xyXG52YXIgbW9yZV8xID0gcmVxdWlyZShcIi4vbW9yZVwiKTtcclxudmFyIENTRyA9IHJlcXVpcmUoXCIuL2NzZy5qc1wiKTtcclxudmFyIFZpZXdlciA9IHJlcXVpcmUoXCIuL3ZpZXdlci5qc1wiKTtcclxuY29uc29sZS5sb2coVmlld2VyKTtcclxudmFyIGJveCA9IHtcclxuICAgIG91dGxpbmU6IHtcclxuICAgICAgICB3aWR0aDogODEsXHJcbiAgICAgICAgZGVwdGg6IDc5LFxyXG4gICAgICAgIGhlaWdodDogNDBcclxuICAgIH0sXHJcbiAgICBpbnRlcm5hbDoge1xyXG4gICAgICAgIHdpZHRoOiA4MSArIDEwLFxyXG4gICAgICAgIGRlcHRoOiA3OSArIDEwLFxyXG4gICAgICAgIGhlaWdodDogNDBcclxuICAgIH0sXHJcbiAgICB0aGlja25lc3M6IHtcclxuICAgICAgICBib2R5OiB7XHJcbiAgICAgICAgICAgIHdhbGw6IDIsXHJcbiAgICAgICAgICAgIGJhc2U6IDJcclxuICAgICAgICB9LFxyXG4gICAgICAgIGxpZDoge1xyXG4gICAgICAgICAgICBvdXRlcjogMlxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBvdGhlcjoge1xyXG4gICAgICAgIGNvcm5lcl9yYWRpdXM6IDEwLFxyXG4gICAgICAgIGNhdGNoOiB7XHJcbiAgICAgICAgICAgIGhlaWdodDogNSxcclxuICAgICAgICAgICAgd2lkdGg6IDIwLFxyXG4gICAgICAgICAgICBkZXB0aDogNVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbiAgICBtb3VudDoge1xyXG4gICAgICAgIHJhZGl1czogNCxcclxuICAgICAgICBoZWlnaHQ6IDQsXHJcbiAgICAgICAgaG9sZToge1xyXG4gICAgICAgICAgICBoZWlnaHQ6IDMsXHJcbiAgICAgICAgICAgIGlubmVyX3JhZGl1czogMixcclxuICAgICAgICAgICAgb3V0ZXJfcmFkaXVzOiAzLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbG9jYXRpb25zOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHg6IC01LFxyXG4gICAgICAgICAgICAgICAgeTogMjRcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgeDogLTUsXHJcbiAgICAgICAgICAgICAgICB5OiA2MFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB4OiAzMSxcclxuICAgICAgICAgICAgICAgIHk6IDI1XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIHg6IDcuNSxcclxuICAgICAgICAgICAgICAgIHk6IDYwXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICBdXHJcbiAgICB9LFxyXG4gICAgbGlkX21vdW50OiB7XHJcbiAgICAgICAgcmFkaXVzOiA2LFxyXG4gICAgICAgIGhlaWdodDogNCxcclxuICAgICAgICBob2xlOiB7XHJcbiAgICAgICAgICAgIGhlaWdodDogMyxcclxuICAgICAgICAgICAgcmFkaXVzOiAyLFxyXG4gICAgICAgIH0sXHJcbiAgICB9XHJcbn07XHJcbmZ1bmN0aW9uIGJveF9jb250b3VyKHdpZHRoLCBoZWlnaHQsIHJhZGl1cykge1xyXG4gICAgdmFyIGhjID0gaGVpZ2h0IC0gMiAqIHJhZGl1cztcclxuICAgIHZhciB3YyA9IHdpZHRoIC0gMiAqIHJhZGl1cztcclxuICAgIHZhciBwbCA9IG5ldyBtb3JlXzEuTGluZSh3aWR0aCAvIDIsIDApLmxpbmUoMCwgaGMgLyAyKS5hcmMoeyByeDogcmFkaXVzIH0pLmxpbmUoLXdjLCAwKS5hcmMoeyByeDogcmFkaXVzLCBzdGFydDogTWF0aC5QSSAvIDIgfSkubGluZSgwLCAtaGMpLmFyYyh7IHJ4OiByYWRpdXMsIHN0YXJ0OiBNYXRoLlBJIH0pLmxpbmUod2MsIDApLmFyYyh7IHJ4OiByYWRpdXMsIHN0YXJ0OiBNYXRoLlBJICogMS41IH0pO1xyXG4gICAgcmV0dXJuIHBsLnRvUG9seWdvbigpO1xyXG59XHJcbmZ1bmN0aW9uIGJveF9jb250b3VyMyh3aWR0aCwgaGVpZ2h0LCByYWRpdXMpIHtcclxuICAgIHZhciBoYyA9IGhlaWdodCAtIDIgKiByYWRpdXM7XHJcbiAgICB2YXIgd2MgPSB3aWR0aCAtIDIgKiByYWRpdXM7XHJcbiAgICB2YXIgcGwgPSBuZXcgbW9yZV8xLkxpbmUod2lkdGggLyAyLCAwKS5saW5lKDAsIGhjIC8gMikubGluZSgtcmFkaXVzLCByYWRpdXMpLmxpbmUoLXdjLCAwKS5saW5lKC1yYWRpdXMsIC1yYWRpdXMpLmxpbmUoMCwgLWhjKS5saW5lKHJhZGl1cywgLXJhZGl1cykubGluZSh3YywgMCkubGluZShyYWRpdXMsIHJhZGl1cyk7XHJcbiAgICByZXR1cm4gcGwudG9Qb2x5Z29uKCk7XHJcbn1cclxuZnVuY3Rpb24gbWFrZV9tb3VudChsb2MpIHtcclxuICAgIHZhciBtZCA9IGJveC5tb3VudDtcclxuICAgIHZhciBpID0gYm94Lm91dGxpbmU7XHJcbiAgICB2YXIgdGggPSBib3gudGhpY2tuZXNzLmJvZHkuYmFzZSArIG1kLmhlaWdodDtcclxuICAgIHZhciBtID0gbmV3IG1vcmVfMS5MaW5lKG1kLnJhZGl1cywgMCkuYXJjKHsgcng6IG1kLnJhZGl1cywgYXJjOiAyICogTWF0aC5QSSwgc2xpY2VzOiAyNCB9KS50b1BvbHlnb24oKTtcclxuICAgIHZhciBtYyA9IG1vcmVfMS5leHRydWRlKG0sIFswLCAwLCB0aF0pO1xyXG4gICAgdmFyIGhvbGUgPSBuZXcgbW9yZV8xLkxpbmUobWQuaG9sZS5vdXRlcl9yYWRpdXMsIDApLmFyYyh7IHJ4OiBtZC5ob2xlLm91dGVyX3JhZGl1cywgYXJjOiAyICogTWF0aC5QSSwgc2xpY2VzOiA2IH0pLnRvUG9seWdvbigpO1xyXG4gICAgdmFyIGhvbGVwID0gbW9yZV8xLmV4dHJ1ZGUoaG9sZSwgWzAsIDAsIG1kLmhvbGUuaGVpZ2h0XSk7XHJcbiAgICBob2xlID0gbmV3IG1vcmVfMS5MaW5lKG1kLmhvbGUuaW5uZXJfcmFkaXVzLCAwKS5hcmMoeyByeDogbWQuaG9sZS5pbm5lcl9yYWRpdXMsIGFyYzogMiAqIE1hdGguUEksIHNsaWNlczogMTIgfSlcclxuICAgICAgICAudG9Qb2x5Z29uKCk7XHJcbiAgICBob2xlcCA9IGhvbGVwLnVuaW9uKG1vcmVfMS5leHRydWRlKGhvbGUsIFswLCAwLCB0aF0pKTtcclxuICAgIG1vcmVfMS50cmFuc2xhdGUobWMsIGxvYyk7XHJcbiAgICBtb3JlXzEudHJhbnNsYXRlKGhvbGVwLCBsb2MpO1xyXG4gICAgcmV0dXJuIFttYywgaG9sZXBdO1xyXG59XHJcbmZ1bmN0aW9uIG1ha2VfbGlkX21vdW50KGJvZHksIGxvYykge1xyXG4gICAgdmFyIG1kID0gYm94LmxpZF9tb3VudDtcclxuICAgIHZhciBpID0gYm94Lm91dGxpbmU7XHJcbiAgICB2YXIgbSA9IG1vcmVfMS5MaW5lLnJlY3QobWQucmFkaXVzKS50b1BvbHlnb24oKTtcclxuICAgIHZhciBtID0gbW9yZV8xLmV4dHJ1ZGUobSwgWzAsIDAsIG1kLmhlaWdodF0pO1xyXG4gICAgdmFyIGhvbGUgPSBtb3JlXzEuTGluZS5jaXJjbGUobWQuaG9sZS5yYWRpdXMpLnRvUG9seWdvbigpO1xyXG4gICAgdmFyIGhvbGVwID0gbW9yZV8xLmV4dHJ1ZGUoaG9sZSwgWzAsIDAsIG1kLmhlaWdodF0pO1xyXG4gICAgdmFyIGF4aXMgPSBuZXcgQ1NHLlZlY3RvcigwLCAxLCAwKTtcclxuICAgIG0gPSBtb3JlXzEucm90YXRlKG0sIDkwLCBheGlzKTtcclxuICAgIGhvbGVwID0gbW9yZV8xLnJvdGF0ZShob2xlcCwgOTAsIGF4aXMpO1xyXG4gICAgbW9yZV8xLnRyYW5zbGF0ZShtLCBsb2MpO1xyXG4gICAgbW9yZV8xLnRyYW5zbGF0ZShob2xlcCwgbG9jKTtcclxuICAgIHJldHVybiBib2R5LnVuaW9uKG0pLnN1YnRyYWN0KGhvbGVwKTtcclxufVxyXG5mdW5jdGlvbiBhZGRfbW91bnRzKGJvZHkpIHtcclxuICAgIHZhciBtZCA9IGJveC5tb3VudDtcclxuICAgIHZhciBpID0gYm94Lm91dGxpbmU7XHJcbiAgICBtZC5sb2NhdGlvbnMuZm9yRWFjaChmdW5jdGlvbiAobCkge1xyXG4gICAgICAgIHZhciBtID0gbWFrZV9tb3VudChbKGwueCA+IDAgPyAtMSA6IDEpICogaS53aWR0aCAvIDIgKyBsLngsIChsLnkgPiAwID8gLTEgOiAxKSAqIGkuZGVwdGggLyAyICsgbC55LCAwXSk7XHJcbiAgICAgICAgYm9keSA9IGJvZHkudW5pb24obVswXSk7XHJcbiAgICAgICAgYm9keSA9IGJvZHkuc3VidHJhY3QobVsxXSk7XHJcbiAgICB9KTtcclxuICAgIHZhciBpID0gYm94LmludGVybmFsO1xyXG4gICAgdmFyIGxkID0gYm94LmxpZF9tb3VudDtcclxuICAgIHZhciBoID0gaS5oZWlnaHQgLSBsZC5yYWRpdXMgLSBib3gudGhpY2tuZXNzLmxpZC5vdXRlcjtcclxuICAgIGJvZHkgPSBtYWtlX2xpZF9tb3VudChib2R5LCBuZXcgQ1NHLlZlY3RvcigtaS53aWR0aCAvIDIsIDAsIGgpKTtcclxuICAgIGJvZHkgPSBtYWtlX2xpZF9tb3VudChib2R5LCBuZXcgQ1NHLlZlY3RvcihpLndpZHRoIC8gMiAtIGxkLmhlaWdodCwgMCwgaCkpO1xyXG4gICAgcmV0dXJuIGJvZHk7XHJcbn1cclxuZnVuY3Rpb24gb3V0bGluZSgpIHtcclxuICAgIHZhciBpID0gYm94Lm91dGxpbmU7XHJcbiAgICB2YXIgcG9seSA9IG5ldyBtb3JlXzEuTGluZShpLndpZHRoIC8gMiwgMCkubGluZSgwLCBpLmRlcHRoIC8gMikubGluZSgtaS53aWR0aCwgMCkubGluZSgwLCAtaS5kZXB0aCkubGluZShpLndpZHRoLCAwKS5saW5lKDAsIGkuZGVwdGggLyAyKS50b1BvbHlnb24oeyB6OiAxMCB9KTtcclxuICAgIHJldHVybiBDU0cuZnJvbVBvbHlnb25zKFtwb2x5XSk7XHJcbn1cclxuZnVuY3Rpb24gYm9keSgpIHtcclxuICAgIHZhciBpID0gYm94LmludGVybmFsO1xyXG4gICAgdmFyIHRiID0gYm94LnRoaWNrbmVzcy5ib2R5O1xyXG4gICAgdmFyIHRsID0gYm94LnRoaWNrbmVzcy5saWQ7XHJcbiAgICB2YXIgY3IgPSBib3gub3RoZXIuY29ybmVyX3JhZGl1cztcclxuICAgIHZhciBvdXRlciA9IG1vcmVfMS5leHRydWRlKGJveF9jb250b3VyKGkud2lkdGgsIGkuZGVwdGgsIGNyKSwgWzAsIDAsIGkuaGVpZ2h0XSk7XHJcbiAgICB2YXIgaW5uZXIgPSBtb3JlXzEuZXh0cnVkZShib3hfY29udG91cihpLndpZHRoIC0gdGIud2FsbCAqIDIsIGkuZGVwdGggLSB0Yi53YWxsICogMiwgY3IgLSB0Yi53YWxsIC8gMiksIFswLCAwLCBpLmhlaWdodCAtIHRiLmJhc2VdKTtcclxuICAgIG1vcmVfMS50cmFuc2xhdGUoaW5uZXIsIFswLCAwLCB0Yi5iYXNlXSk7XHJcbiAgICB2YXIgc2hlbGwgPSBvdXRlci5zdWJ0cmFjdChpbm5lcik7XHJcbiAgICAvLyBjdXQgb3V0IGxpZCBzbG90XHJcbiAgICB2YXIgbGlkX291dGVyID0gbW9yZV8xLmV4dHJ1ZGUoYm94X2NvbnRvdXIoaS53aWR0aCAtIHRiLndhbGwsIGkuZGVwdGggLSB0Yi53YWxsLCBjciksIFswLCAwLCB0bC5vdXRlcl0pO1xyXG4gICAgbW9yZV8xLnRyYW5zbGF0ZShsaWRfb3V0ZXIsIFswLCAwLCBpLmhlaWdodCAtIHRsLm91dGVyXSk7XHJcbiAgICBzaGVsbCA9IHNoZWxsLnN1YnRyYWN0KGxpZF9vdXRlcik7XHJcbiAgICAvLyAvLyBhZGQgbGlkIGNhdGNoXHJcbiAgICAvLyB2YXIgbGMgPSBib3gub3RoZXIuY2F0Y2hcclxuICAgIC8vIHZhciBjYXQgPSBuZXcgTGluZSgwLCAwKS5saW5lKDAsIGxjLmhlaWdodCkubGluZSgtbGMuZGVwdGgsIDApLmxpbmUoMCwgLWxjLmhlaWdodCkudHJhbnNsYXRlKGkud2lkdGggLyAyLCBpLmhlaWdodCAtIDAuNSkudG9Qb2x5Z29uKHsgeTogLWxjLndpZHRoIC8gMiB9KVxyXG4gICAgLy8gbGMgPSBleHRydWRlKGNhdCwgWzAsIGxjLndpZHRoLCAwXSlcclxuICAgIC8vIGFkZCBsaWQgaG9va1xyXG4gICAgLy8gdmFyIGhvb2sgPSBuZXcgTGluZSgwLCAwKS5saW5lKDAsIDEpLmxpbmUoLWxjLmRlcHRoLCAwKS5saW5lKDAsIC1sYy5oZWlnaHQpLmNsb3NlKCkudHJhbnNsYXRlKGkud2lkdGggLyAyLCBpLmhlaWdodCAtIDAuNSkudG9Qb2x5Z29uKHsgeTogLWxjLndpZHRoIC8gMiB9KVxyXG4gICAgLy8gbGMgPSBleHRydWRlKHsgcG9seWdvbjogY2F0LCBkOiBbMCwgbGMud2lkdGgsIDBdIH0pXHJcbiAgICAvLyAgc2hlbGwgPSBzaGVsbC51bmlvbihsYyk7XHJcbiAgICAvLyBtb3VudHNcclxuICAgIHNoZWxsID0gYWRkX21vdW50cyhzaGVsbCk7XHJcbiAgICByZXR1cm4gc2hlbGw7XHJcbn1cclxuVmlld2VyLmFkZFZpZXdlcihuZXcgVmlld2VyKFtib2R5KCkgLyosb3V0bGluZSgpKi9dLCA1MDAsIDUwMCwgNTAwKSk7XHJcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW1haW4uanMubWFwIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KTtcclxudmFyIENTRyA9IHJlcXVpcmUoXCIuL2NzZy5qc1wiKTtcclxudmFyIEdMID0gcmVxdWlyZShcIi4vbGlnaHRnbC5qc1wiKTtcclxuQXJyYXkucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChpKSB7XHJcbiAgICBpZiAoaSA8IDApXHJcbiAgICAgICAgcmV0dXJuIHRoaXNbdGhpcy5sZW5ndGggKyBpXTtcclxuICAgIGlmIChpID49IHRoaXMubGVuZ3RoKVxyXG4gICAgICAgIHJldHVybiB0aGlzW2kgLSB0aGlzLmxlbmd0aF07XHJcbiAgICByZXR1cm4gdGhpc1tpXTtcclxufTtcclxuZnVuY3Rpb24gZG93bmxvYWQoZGF0YSwgZmlsZW5hbWUsIHR5cGUpIHtcclxuICAgIHZhciBmaWxlID0gbmV3IEJsb2IoW2RhdGFdLCB7IHR5cGU6IHR5cGUgfSk7XHJcbiAgICBpZiAod2luZG93Lm5hdmlnYXRvci5tc1NhdmVPck9wZW5CbG9iKSAvLyBJRTEwK1xyXG4gICAgICAgIHdpbmRvdy5uYXZpZ2F0b3IubXNTYXZlT3JPcGVuQmxvYihmaWxlLCBmaWxlbmFtZSk7XHJcbiAgICBlbHNlIHsgLy8gT3RoZXJzXHJcbiAgICAgICAgdmFyIGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKSwgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKTtcclxuICAgICAgICBhLmhyZWYgPSB1cmw7XHJcbiAgICAgICAgYS5kb3dubG9hZCA9IGZpbGVuYW1lO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XHJcbiAgICAgICAgYS5jbGljaygpO1xyXG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGEpO1xyXG4gICAgICAgICAgICB3aW5kb3cuVVJMLnJldm9rZU9iamVjdFVSTCh1cmwpO1xyXG4gICAgICAgIH0sIDApO1xyXG4gICAgfVxyXG59XHJcbmV4cG9ydHMuZG93bmxvYWQgPSBkb3dubG9hZDtcclxudmFyIGhpbnQgPSAwLjAwMDAxO1xyXG5mdW5jdGlvbiBwb2x5KCkge1xyXG4gICAgdmFyIHB0cyA9IFtdO1xyXG4gICAgZm9yICh2YXIgX2kgPSAwOyBfaSA8IGFyZ3VtZW50cy5sZW5ndGg7IF9pKyspIHtcclxuICAgICAgICBwdHNbX2ldID0gYXJndW1lbnRzW19pXTtcclxuICAgIH1cclxuICAgIGlmIChwdHNbMF0gaW5zdGFuY2VvZiBBcnJheSlcclxuICAgICAgICBwdHMgPSBwdHMubWFwKGZ1bmN0aW9uIChlKSB7IHJldHVybiBuZXcgQ1NHLlZlY3RvcihlKTsgfSk7XHJcbiAgICB2YXIgbiA9IGZhY2VOb3JtYWwocHRzLCAwKTtcclxuICAgIGlmIChpc05hTihuLngpKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2cocHRzKTtcclxuICAgICAgICB0aHJvdyBcImJhZCBmYWNlIG5vcm1hbFwiO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ldyBDU0cuUG9seWdvbihwdHMubWFwKGZ1bmN0aW9uIChwKSB7IHJldHVybiBuZXcgQ1NHLlZlcnRleChwLCBuKTsgfSkpO1xyXG59XHJcbmZ1bmN0aW9uIGZhY2VOb3JtYWwodnMsIGlkeCkge1xyXG4gICAgdmFyIHYxID0gdnNbMSArIGlkeF0ubWludXModnNbMF0pO1xyXG4gICAgdmFyIHYyID0gdnNbMiArIGlkeF0ubWludXModnNbMF0pO1xyXG4gICAgcmV0dXJuIHYxLmNyb3NzKHYyKS51bml0KCk7XHJcbn1cclxuZnVuY3Rpb24gYW5udWx1cyhfYSkge1xyXG4gICAgdmFyIGhlaWdodCA9IF9hLmhlaWdodCwgb3V0ZXIgPSBfYS5vdXRlciwgaW5uZXIgPSBfYS5pbm5lciwgX2IgPSBfYS5zbGljZXMsIHNsaWNlcyA9IF9iID09PSB2b2lkIDAgPyAxNiA6IF9iO1xyXG4gICAgdmFyIG9jID0gQ1NHLmN5bGluZGVyKHtcclxuICAgICAgICBzdGFydDogWzAsIDAsIC1oZWlnaHQgLyAyXSxcclxuICAgICAgICBlbmQ6IFswLCAwLCBoZWlnaHQgLyAyXSxcclxuICAgICAgICByYWRpdXM6IG91dGVyLFxyXG4gICAgICAgIHNsaWNlczogKHNsaWNlcyAqIG91dGVyIC8gaW5uZXIpIHwgMFxyXG4gICAgfSk7XHJcbiAgICB2YXIgaWMgPSBDU0cuY3lsaW5kZXIoe1xyXG4gICAgICAgIHN0YXJ0OiBbMCwgMCwgLWhlaWdodCAvIDIgLSBoaW50XSxcclxuICAgICAgICBlbmQ6IFswLCAwLCBoZWlnaHQgLyAyICsgaGludF0sXHJcbiAgICAgICAgcmFkaXVzOiBpbm5lcixcclxuICAgICAgICBzbGljZXM6IHNsaWNlc1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gb2Muc3VidHJhY3QoaWMpO1xyXG59XHJcbmZ1bmN0aW9uIHNsb3QoX2EpIHtcclxuICAgIHZhciBoZWlnaHQgPSBfYS5oZWlnaHQsIGxlbmd0aCA9IF9hLmxlbmd0aCwgaGVhZCA9IF9hLmhlYWQsIHNoYWZ0ID0gX2Euc2hhZnQsIF9iID0gX2Euc2xpY2VzLCBzbGljZXMgPSBfYiA9PT0gdm9pZCAwID8gMTYgOiBfYjtcclxuICAgIHZhciBsYyA9IENTRy5jeWxpbmRlcih7XHJcbiAgICAgICAgc3RhcnQ6IFstbGVuZ3RoIC8gMiwgMCwgLWhlaWdodCAvIDJdLFxyXG4gICAgICAgIGVuZDogWy1sZW5ndGggLyAyLCAwLCBoZWlnaHQgLyAyXSxcclxuICAgICAgICByYWRpdXM6IHNoYWZ0LFxyXG4gICAgICAgIHNsaWNlczogc2xpY2VzXHJcbiAgICB9KTtcclxuICAgIHZhciBiYyA9IENTRy5jeWxpbmRlcih7XHJcbiAgICAgICAgc3RhcnQ6IFtsZW5ndGggLyAyLCAwLCAtaGVpZ2h0IC8gMl0sXHJcbiAgICAgICAgZW5kOiBbbGVuZ3RoIC8gMiwgMCwgaGVpZ2h0IC8gMl0sXHJcbiAgICAgICAgcmFkaXVzOiBoZWFkLFxyXG4gICAgICAgIHNsaWNlczogc2xpY2VzXHJcbiAgICB9KTtcclxuICAgIHZhciBib3ggPSBDU0cuY3ViZSh7IHJhZGl1czogW2xlbmd0aCAvIDIgKyBoaW50LCBzaGFmdCwgaGVpZ2h0IC8gMl0gfSk7XHJcbiAgICByZXR1cm4gbGMudW5pb24oYmMpLnVuaW9uKGJveCk7XHJcbn1cclxuZnVuY3Rpb24gcmVjdChfYSkge1xyXG4gICAgdmFyIHggPSBfYS54LCB5ID0gX2EueSwgX2IgPSBfYS56LCB6ID0gX2IgPT09IHZvaWQgMCA/IDAgOiBfYjtcclxuICAgIHJldHVybiBwb2x5KFt4IC8gMiwgeSAvIDIsIHpdLCBbLXggLyAyLCB5IC8gMl0pO1xyXG59XHJcbmZ1bmN0aW9uIGhleGFnb24oX2EpIHtcclxuICAgIHZhciByID0gX2EuciwgX2IgPSBfYS56LCB6ID0gX2IgPT09IHZvaWQgMCA/IDAgOiBfYjtcclxuICAgIHZhciBIID0gTWF0aC5zaW4oTWF0aC5QSSAqIDYwIC8gMTgwKSAqIHI7XHJcbiAgICB2YXIgVyA9IE1hdGguY29zKE1hdGguUEkgKiA2MCAvIDE4MCkgKiByO1xyXG4gICAgcmV0dXJuIHBvbHkoW3IsIDAsIHpdLCBbVywgSCwgel0sIFstVywgSCwgel0sIFstciwgMCwgel0sIFstVywgLUgsIHpdLCBbVywgLUgsIHpdLCBbciwgMCwgel0pO1xyXG59XHJcbmZ1bmN0aW9uIGV4dHJ1ZGUocG9seWdvbiwgZCkge1xyXG4gICAgaWYgKGQgaW5zdGFuY2VvZiBBcnJheSlcclxuICAgICAgICBkID0gbmV3IENTRy5WZWN0b3IoZCk7XHJcbiAgICByZXR1cm4gcHJpc20oW3BvbHlnb24sIHBvbHlnb24uY2xvbmUoKS50cmFuc2xhdGUoZCldKTtcclxufVxyXG5leHBvcnRzLmV4dHJ1ZGUgPSBleHRydWRlO1xyXG5mdW5jdGlvbiBwcmlzbShwb2x5Z29ucykge1xyXG4gICAgdmFyIGlkeCA9IDA7XHJcbiAgICB2YXIgZmlyc3QgPSBwb2x5Z29uc1tpZHgrK107XHJcbiAgICB2YXIgcHMgPSBbZmlyc3RdO1xyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgICB2YXIgbGFzdCA9IHBvbHlnb25zW2lkeCsrXTtcclxuICAgICAgICBpZiAoIWxhc3QpXHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgIHZhciBkID0gbGFzdC52ZXJ0aWNlc1swXS5wb3MubWludXMoZmlyc3QudmVydGljZXNbMF0ucG9zKTtcclxuICAgICAgICBpZiAoZmlyc3QucGxhbmUubm9ybWFsLmRvdChkKSA+IDApXHJcbiAgICAgICAgICAgIGZpcnN0LmZsaXAoKTtcclxuICAgICAgICBpZiAobGFzdC5wbGFuZS5ub3JtYWwuZG90KGQpIDwgMClcclxuICAgICAgICAgICAgbGFzdC5mbGlwKCk7XHJcbiAgICAgICAgdmFyIGwgPSBmaXJzdC52ZXJ0aWNlcy5sZW5ndGggLSAxO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IGw7IGkrKykge1xyXG4gICAgICAgICAgICBwcy5wdXNoKHBvbHkoZmlyc3QudmVydGljZXNbaV0ucG9zLCBsYXN0LnZlcnRpY2VzW2wgLSBpXS5wb3MsIGxhc3QudmVydGljZXMuZ2V0KGwgLSBpIC0gMSkucG9zLCBmaXJzdC52ZXJ0aWNlcy5nZXQoaSArIDEpLnBvcywgZmlyc3QudmVydGljZXNbaV0ucG9zKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpcnN0ID0gbGFzdDtcclxuICAgIH1cclxuICAgIHBzLnB1c2goZmlyc3QpO1xyXG4gICAgcmV0dXJuIENTRy5mcm9tUG9seWdvbnMocHMpO1xyXG59XHJcbmV4cG9ydHMucHJpc20gPSBwcmlzbTtcclxuLy8gZnVuY3Rpb24gdHJpYW5nbGUoeyByLCB6ID0gMCB9KSB7XHJcbi8vICAgcmV0dXJuIHBvbHkoWzAsIDAsIC1sXSwgWzAsIHIsIC1sXSwgW3IsIDAsIC1sXVswLCAwLCAtbF0pXHJcbi8vIH1cclxuZnVuY3Rpb24gdHJhbnNsYXRlKGMsIHYpIHtcclxuICAgIGlmICh2IGluc3RhbmNlb2YgQXJyYXkpXHJcbiAgICAgICAgdiA9IG5ldyBDU0cuVmVjdG9yKHYpO1xyXG4gICAgYy5wb2x5Z29ucy5mb3JFYWNoKGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgZS52ZXJ0aWNlcy5mb3JFYWNoKGZ1bmN0aW9uIChldikgeyByZXR1cm4gZXYucG9zID0gZXYucG9zLnBsdXModik7IH0pO1xyXG4gICAgICAgIGUucGxhbmUudyA9IGUucGxhbmUubm9ybWFsLmRvdChlLnZlcnRpY2VzWzBdKTtcclxuICAgIH0pO1xyXG59XHJcbmV4cG9ydHMudHJhbnNsYXRlID0gdHJhbnNsYXRlO1xyXG5mdW5jdGlvbiByb3RhdGUoYywgYSwgdikge1xyXG4gICAgdmFyIG0gPSBHTC5NYXRyaXgucm90YXRlKGEsIHYueCwgdi55LCB2LnopO1xyXG4gICAgdmFyIHAgPSBbXTtcclxuICAgIGMucG9seWdvbnMuZm9yRWFjaChmdW5jdGlvbiAoZSkge1xyXG4gICAgICAgIHAucHVzaChuZXcgQ1NHLlBvbHlnb24oZS52ZXJ0aWNlcy5tYXAoZnVuY3Rpb24gKGV2KSB7IHJldHVybiBldi5yb3RhdGUobSk7IH0pKSk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybiBDU0cuZnJvbVBvbHlnb25zKHApO1xyXG59XHJcbmV4cG9ydHMucm90YXRlID0gcm90YXRlO1xyXG52YXIgTGluZSA9IC8qKiBAY2xhc3MgKi8gKGZ1bmN0aW9uICgpIHtcclxuICAgIGZ1bmN0aW9uIExpbmUoeCwgeSkge1xyXG4gICAgICAgIGlmICh4ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5sb2MgPSBbeCwgeV07XHJcbiAgICAgICAgICAgIHRoaXMucG9pbnRzID0gW3RoaXMubG9jXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBMaW5lLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgbDIgPSBuZXcgTGluZSgpO1xyXG4gICAgICAgIGwyLnBvaW50cyA9IFtdO1xyXG4gICAgICAgIHRoaXMucG9pbnRzLmZvckVhY2goZnVuY3Rpb24gKHApIHsgcmV0dXJuIGwyLnBvaW50cy5wdXNoKFtwWzBdLCBwWzFdXSk7IH0pO1xyXG4gICAgICAgIGwyLmxvY1RvTGFzdCgpO1xyXG4gICAgICAgIHJldHVybiBsMjtcclxuICAgIH07XHJcbiAgICBMaW5lLnByb3RvdHlwZS5tb3ZlVG8gPSBmdW5jdGlvbiAoeCwgeSkge1xyXG4gICAgICAgIHRoaXMubG9jID0gW3gsIHldO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExpbmUucHJvdG90eXBlLmxpbmVUbyA9IGZ1bmN0aW9uICh4LCB5KSB7XHJcbiAgICAgICAgdGhpcy5wb2ludHMucHVzaCh0aGlzLmxvYyA9IFt4LCB5XSk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9O1xyXG4gICAgTGluZS5wcm90b3R5cGUubGluZSA9IGZ1bmN0aW9uICh4LCB5KSB7XHJcbiAgICAgICAgdGhpcy5wb2ludHMucHVzaChbdGhpcy5sb2NbMF0gKyB4LCB0aGlzLmxvY1sxXSArIHldKTtcclxuICAgICAgICB0aGlzLmxvY1RvTGFzdCgpO1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfTtcclxuICAgIExpbmUucHJvdG90eXBlLmxvY1RvTGFzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmxvYyA9IHRoaXMucG9pbnRzW3RoaXMucG9pbnRzLmxlbmd0aCAtIDFdO1xyXG4gICAgfTtcclxuICAgIExpbmUucHJvdG90eXBlLm1vdmUgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG4gICAgICAgIHRoaXMubG9jID0gW3RoaXMubG9jWzBdICsgeCwgdGhpcy5sb2NbMV0gKyB5XTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMaW5lLnByb3RvdHlwZS50cmFuc2xhdGUgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG4gICAgICAgIHRoaXMucG9pbnRzLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgdlswXSArPSB4O1xyXG4gICAgICAgICAgICB2WzFdICs9IHk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5sb2NUb0xhc3QoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMaW5lLnByb3RvdHlwZS5hcmMgPSBmdW5jdGlvbiAoX2EpIHtcclxuICAgICAgICB2YXIgcnggPSBfYS5yeCwgX2IgPSBfYS5yeSwgcnkgPSBfYiA9PT0gdm9pZCAwID8gcnggOiBfYiwgX2MgPSBfYS5zdGFydCwgc3RhcnQgPSBfYyA9PT0gdm9pZCAwID8gMCA6IF9jLCBfZCA9IF9hLmFyYywgYXJjID0gX2QgPT09IHZvaWQgMCA/IE1hdGguUEkgLyAyIDogX2QsIF9lID0gX2Euc2xpY2VzLCBzbGljZXMgPSBfZSA9PT0gdm9pZCAwID8gNCA6IF9lLCBhcmNkID0gX2EuYXJjZDtcclxuICAgICAgICBpZiAoYXJjZCAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICAgICAgICBhcmMgPSBhcmNkIC8gMTgwICogTWF0aC5QSTtcclxuICAgICAgICB2YXIgZW5kID0gc3RhcnQgKyBhcmM7XHJcbiAgICAgICAgdGhpcy5tb3ZlKC1yeCAqIE1hdGguY29zKHN0YXJ0KSwgLXJ5ICogTWF0aC5zaW4oc3RhcnQpKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8PSBzbGljZXM7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgYSA9IHN0YXJ0ICsgYXJjIC8gc2xpY2VzICogaTtcclxuICAgICAgICAgICAgdGhpcy5wb2ludHMucHVzaChbdGhpcy5sb2NbMF0gKyByeCAqIE1hdGguY29zKGEpLCB0aGlzLmxvY1sxXSArIHJ5ICogTWF0aC5zaW4oYSldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5sb2NUb0xhc3QoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMaW5lLnJlY3QgPSBmdW5jdGlvbiAoeCwgeSkge1xyXG4gICAgICAgIGlmICh5ID09PSB2b2lkIDApIHsgeSA9IHg7IH1cclxuICAgICAgICByZXR1cm4gbmV3IExpbmUoeCwgMCkubGluZSgwLCB5KS5saW5lKC0yICogeCwgMCkubGluZSgwLCAtMiAqIHkpLmxpbmUoMiAqIHgsIDApO1xyXG4gICAgfTtcclxuICAgIExpbmUuY2lyY2xlID0gZnVuY3Rpb24gKHJ4LCByeSwgc2xpY2VzKSB7XHJcbiAgICAgICAgaWYgKHJ5ID09PSB2b2lkIDApIHsgcnkgPSByeDsgfVxyXG4gICAgICAgIGlmIChzbGljZXMgPT09IHZvaWQgMCkgeyBzbGljZXMgPSAxMjsgfVxyXG4gICAgICAgIHJldHVybiBuZXcgTGluZShyeCwgMCkuYXJjKHsgcng6IHJ4LCByeTogcnksIGFyY2Q6IDM2MCwgc2xpY2VzOiBzbGljZXMgfSk7XHJcbiAgICB9O1xyXG4gICAgTGluZS5wcm90b3R5cGUuc2hyaW5rID0gZnVuY3Rpb24gKG9mcykge1xyXG4gICAgICAgIHZhciBzb2ZzID0gTWF0aC5zcXJ0KG9mcyk7XHJcbiAgICAgICAgdmFyIHIgPSBuZXcgTGluZSgpO1xyXG4gICAgICAgIHIucG9pbnRzID0gW107XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLnBvaW50cy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdjAgPSBuZXcgQ1NHLlZlY3Rvcih0aGlzLnBvaW50cy5nZXQoaSlbMF0sIHRoaXMucG9pbnRzLmdldChpKVsxXSwgMCk7XHJcbiAgICAgICAgICAgIHZhciB2MSA9IG5ldyBDU0cuVmVjdG9yKHRoaXMucG9pbnRzLmdldChpIC0gMSlbMF0sIHRoaXMucG9pbnRzLmdldChpIC0gMSlbMV0sIDApO1xyXG4gICAgICAgICAgICB2YXIgdjIgPSBuZXcgQ1NHLlZlY3Rvcih0aGlzLnBvaW50cy5nZXQoaSArIDEpWzBdLCB0aGlzLnBvaW50cy5nZXQoaSArIDEpWzFdLCAwKTtcclxuICAgICAgICAgICAgdmFyIHYxMCA9IHYxLm1pbnVzKHYwKS51bml0KCk7XHJcbiAgICAgICAgICAgIHZhciB2MjAgPSB2Mi5taW51cyh2MCkudW5pdCgpO1xyXG4gICAgICAgICAgICB2YXIgb3YgPSB2MjAucGx1cyh2MTApLnVuaXQoKS50aW1lcyhzb2ZzKS5wbHVzKHYwKTtcclxuICAgICAgICAgICAgci5wb2ludHMucHVzaChbb3YueCwgb3YueV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICByLmxvY1RvTGFzdCgpO1xyXG4gICAgICAgIHJldHVybiByO1xyXG4gICAgfTtcclxuICAgIExpbmUucHJvdG90eXBlLnNjYWxlID0gZnVuY3Rpb24gKHgsIHkpIHtcclxuICAgICAgICB5ID0geSB8fCB4O1xyXG4gICAgICAgIHRoaXMucG9pbnRzLmZvckVhY2goZnVuY3Rpb24gKHYpIHtcclxuICAgICAgICAgICAgdlswXSAqPSB4O1xyXG4gICAgICAgICAgICB2WzFdICo9IHk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgdGhpcy5sb2NUb0xhc3QoKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH07XHJcbiAgICBMaW5lLnByb3RvdHlwZS50b1BvbHlnb24gPSBmdW5jdGlvbiAoX2EpIHtcclxuICAgICAgICB2YXIgX2IgPSBfYSA9PT0gdm9pZCAwID8geyB6OiAwIH0gOiBfYSwgX2MgPSBfYi56LCB6ID0gX2MgPT09IHZvaWQgMCA/IG51bGwgOiBfYywgX2QgPSBfYi54LCB4ID0gX2QgPT09IHZvaWQgMCA/IG51bGwgOiBfZCwgX2UgPSBfYi55LCB5ID0gX2UgPT09IHZvaWQgMCA/IG51bGwgOiBfZTtcclxuICAgICAgICB2YXIgbTtcclxuICAgICAgICBpZiAoeiAhPSBudWxsKVxyXG4gICAgICAgICAgICBtID0gZnVuY3Rpb24gKGEpIHsgcmV0dXJuIFthWzBdLCBhWzFdLCB6XTsgfTtcclxuICAgICAgICBlbHNlIGlmICh4ICE9IG51bGwpXHJcbiAgICAgICAgICAgIG0gPSBmdW5jdGlvbiAoYSkgeyByZXR1cm4gW3gsIGFbMF0sIGFbMV1dOyB9O1xyXG4gICAgICAgIGVsc2UgaWYgKHkgIT0gbnVsbClcclxuICAgICAgICAgICAgbSA9IGZ1bmN0aW9uIChhKSB7IHJldHVybiBbYVswXSwgeSwgYVsxXV07IH07XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aHJvdyBcIm5vIHBsYW5lXCI7XHJcbiAgICAgICAgdmFyIHpzID0gdGhpcy5wb2ludHMubWFwKGZ1bmN0aW9uIChwKSB7IHJldHVybiBtKHApOyB9KTtcclxuICAgICAgICByZXR1cm4gcG9seS5hcHBseSh2b2lkIDAsIHpzKTtcclxuICAgIH07XHJcbiAgICByZXR1cm4gTGluZTtcclxufSgpKTtcclxuZXhwb3J0cy5MaW5lID0gTGluZTtcclxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bW9yZS5qcy5tYXAiLCJ2YXIgR0wgPSByZXF1aXJlKCcuL2xpZ2h0Z2wuanMnKVxyXG5cclxuLy8gU2V0IHRoZSBjb2xvciBvZiBhbGwgcG9seWdvbnMgaW4gdGhpcyBzb2xpZFxyXG5DU0cucHJvdG90eXBlLnNldENvbG9yID0gZnVuY3Rpb24gKHIsIGcsIGIpIHtcclxuICB0aGlzLnRvUG9seWdvbnMoKS5tYXAoZnVuY3Rpb24gKHBvbHlnb24pIHtcclxuICAgIHBvbHlnb24uc2hhcmVkID0gW3IsIGcsIGJdO1xyXG4gIH0pO1xyXG59O1xyXG5cclxuLy8gQ29udmVydCBmcm9tIENTRyBzb2xpZCB0byBHTC5NZXNoIG9iamVjdFxyXG5DU0cucHJvdG90eXBlLnRvTWVzaCA9IGZ1bmN0aW9uICgpIHtcclxuICB2YXIgbWVzaCA9IG5ldyBHTC5NZXNoKHsgbm9ybWFsczogdHJ1ZSwgY29sb3JzOiB0cnVlIH0pO1xyXG4gIHZhciBpbmRleGVyID0gbmV3IEdMLkluZGV4ZXIoKTtcclxuICB0aGlzLnRvUG9seWdvbnMoKS5tYXAoZnVuY3Rpb24gKHBvbHlnb24pIHtcclxuICAgIHZhciBpbmRpY2VzID0gcG9seWdvbi52ZXJ0aWNlcy5tYXAoZnVuY3Rpb24gKHZlcnRleCkge1xyXG4gICAgICB2ZXJ0ZXguY29sb3IgPSBwb2x5Z29uLnNoYXJlZCB8fCBbMSwgMSwgMV07XHJcbiAgICAgIHJldHVybiBpbmRleGVyLmFkZCh2ZXJ0ZXgpO1xyXG4gICAgfSk7XHJcbiAgICBmb3IgKHZhciBpID0gMjsgaSA8IGluZGljZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgbWVzaC50cmlhbmdsZXMucHVzaChbaW5kaWNlc1swXSwgaW5kaWNlc1tpIC0gMV0sIGluZGljZXNbaV1dKTtcclxuICAgIH1cclxuICB9KTtcclxuICBtZXNoLnZlcnRpY2VzID0gaW5kZXhlci51bmlxdWUubWFwKGZ1bmN0aW9uICh2KSB7IHJldHVybiBbdi5wb3MueCwgdi5wb3MueSwgdi5wb3Muel07IH0pO1xyXG4gIG1lc2gubm9ybWFscyA9IGluZGV4ZXIudW5pcXVlLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gW3Yubm9ybWFsLngsIHYubm9ybWFsLnksIHYubm9ybWFsLnpdOyB9KTtcclxuICBtZXNoLmNvbG9ycyA9IGluZGV4ZXIudW5pcXVlLm1hcChmdW5jdGlvbiAodikgeyByZXR1cm4gdi5jb2xvcjsgfSk7XHJcbiAgbWVzaC5jb21wdXRlV2lyZWZyYW1lKCk7XHJcbiAgcmV0dXJuIG1lc2g7XHJcbn07XHJcblxyXG52YXIgdmlld2VycyA9IFtdO1xyXG5cclxuLy8gU2V0IHRvIHRydWUgc28gbGluZXMgZG9uJ3QgdXNlIHRoZSBkZXB0aCBidWZmZXJcclxuVmlld2VyLmxpbmVPdmVybGF5ID0gZmFsc2U7XHJcblxyXG4vLyBBIHZpZXdlciBpcyBhIFdlYkdMIGNhbnZhcyB0aGF0IGxldHMgdGhlIHVzZXIgdmlldyBhIG1lc2guIFRoZSB1c2VyIGNhblxyXG4vLyB0dW1ibGUgaXQgYXJvdW5kIGJ5IGRyYWdnaW5nIHRoZSBtb3VzZS5cclxuZnVuY3Rpb24gVmlld2VyKGNzZywgd2lkdGgsIGhlaWdodCwgZGVwdGgpIHtcclxuICB2aWV3ZXJzLnB1c2godGhpcyk7XHJcblxyXG4gIHZhciBhbmdsZVggPSAyMDtcclxuICB2YXIgYW5nbGVZID0gMjA7XHJcblxyXG4gIC8vIEdldCBhIG5ldyBXZWJHTCBjYW52YXNcclxuICB2YXIgZ2wgPSBHTC5jcmVhdGUoKTtcclxuICB0aGlzLmdsID0gZ2w7XHJcbiAgdGhpcy5tZXNoID0gW11cclxuICBpZiAoQXJyYXkuaXNBcnJheShjc2cpKVxyXG4gICAgY3NnLmZvckVhY2goYSA9PiB0aGlzLm1lc2gucHVzaChhLnRvTWVzaCgpKSk7XHJcbiAgZWxzZSB0aGlzLm1lc2gucHVzaChjc2cudG9NZXNoKCkpXHJcbiAgLy8gU2V0IHVwIHRoZSB2aWV3cG9ydFxyXG4gIGdsLmNhbnZhcy53aWR0aCA9IHdpZHRoO1xyXG4gIGdsLmNhbnZhcy5oZWlnaHQgPSBoZWlnaHQ7XHJcbiAgZ2wudmlld3BvcnQoMCwgMCwgd2lkdGgsIGhlaWdodCk7XHJcbiAgZ2wubWF0cml4TW9kZShnbC5QUk9KRUNUSU9OKTtcclxuICBnbC5sb2FkSWRlbnRpdHkoKTtcclxuICBnbC5wZXJzcGVjdGl2ZSg0NSwgd2lkdGggLyBoZWlnaHQsIDEsIDUwMDApO1xyXG4gIGdsLm1hdHJpeE1vZGUoZ2wuTU9ERUxWSUVXKTtcclxuXHJcbiAgLy8gU2V0IHVwIFdlYkdMIHN0YXRlXHJcbiAgZ2wuYmxlbmRGdW5jKGdsLlNSQ19BTFBIQSwgZ2wuT05FX01JTlVTX1NSQ19BTFBIQSk7XHJcbiAgZ2wuY2xlYXJDb2xvcigwLjkzLCAwLjkzLCAwLjkzLCAxKTtcclxuICBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XHJcbiAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XHJcbiAgZ2wucG9seWdvbk9mZnNldCgxLCAxKTtcclxuXHJcbiAgLy8gQmxhY2sgc2hhZGVyIGZvciB3aXJlZnJhbWVcclxuICB0aGlzLmJsYWNrU2hhZGVyID0gbmV3IEdMLlNoYWRlcignXFxcclxuICAgIHZvaWQgbWFpbigpIHtcXFxyXG4gICAgICBnbF9Qb3NpdGlvbiA9IGdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXggKiBnbF9WZXJ0ZXg7XFxcclxuICAgIH1cXFxyXG4gICcsICdcXFxyXG4gICAgdm9pZCBtYWluKCkge1xcXHJcbiAgICAgIGdsX0ZyYWdDb2xvciA9IHZlYzQoMC4wLCAwLjAsIDAuMCwgMC4xKTtcXFxyXG4gICAgfVxcXHJcbiAgJyk7XHJcblxyXG4gIC8vIFNoYWRlciB3aXRoIGRpZmZ1c2UgYW5kIHNwZWN1bGFyIGxpZ2h0aW5nXHJcbiAgdGhpcy5saWdodGluZ1NoYWRlciA9IG5ldyBHTC5TaGFkZXIoJ1xcXHJcbiAgICB2YXJ5aW5nIHZlYzMgY29sb3I7XFxcclxuICAgIHZhcnlpbmcgdmVjMyBub3JtYWw7XFxcclxuICAgIHZhcnlpbmcgdmVjMyBsaWdodDtcXFxyXG4gICAgdm9pZCBtYWluKCkge1xcXHJcbiAgICAgIGNvbnN0IHZlYzMgbGlnaHREaXIgPSB2ZWMzKDEuMCwgMi4wLCAzLjApIC8gMy43NDE2NTczODY3NzM5NDE7XFxcclxuICAgICAgbGlnaHQgPSAoZ2xfTW9kZWxWaWV3TWF0cml4ICogdmVjNChsaWdodERpciwgMC4wKSkueHl6O1xcXHJcbiAgICAgIGNvbG9yID0gZ2xfQ29sb3IucmdiO1xcXHJcbiAgICAgIG5vcm1hbCA9IGdsX05vcm1hbE1hdHJpeCAqIGdsX05vcm1hbDtcXFxyXG4gICAgICBnbF9Qb3NpdGlvbiA9IGdsX01vZGVsVmlld1Byb2plY3Rpb25NYXRyaXggKiBnbF9WZXJ0ZXg7XFxcclxuICAgIH1cXFxyXG4gICcsICdcXFxyXG4gICAgdmFyeWluZyB2ZWMzIGNvbG9yO1xcXHJcbiAgICB2YXJ5aW5nIHZlYzMgbm9ybWFsO1xcXHJcbiAgICB2YXJ5aW5nIHZlYzMgbGlnaHQ7XFxcclxuICAgIHZvaWQgbWFpbigpIHtcXFxyXG4gICAgICB2ZWMzIG4gPSBub3JtYWxpemUobm9ybWFsKTtcXFxyXG4gICAgICBmbG9hdCBkaWZmdXNlID0gbWF4KDAuMCwgZG90KGxpZ2h0LCBuKSk7XFxcclxuICAgICAgZmxvYXQgc3BlY3VsYXIgPSBwb3cobWF4KDAuMCwgLXJlZmxlY3QobGlnaHQsIG4pLnopLCAzMi4wKSAqIHNxcnQoZGlmZnVzZSk7XFxcclxuICAgICAgZ2xfRnJhZ0NvbG9yID0gdmVjNChtaXgoY29sb3IgKiAoMC4zICsgMC43ICogZGlmZnVzZSksIHZlYzMoMS4wKSwgc3BlY3VsYXIpLCAxLjApO1xcXHJcbiAgICB9XFxcclxuICAnKTtcclxuXHJcbiAgZ2wub25tb3VzZW1vdmUgPSBmdW5jdGlvbiAoZSkge1xyXG4gICAgaWYgKGUuZHJhZ2dpbmcpIHtcclxuICAgICAgaWYgKGUuYnV0dG9ucyA9PSAxKSB7XHJcbiAgICAgICAgYW5nbGVZICs9IGUuZGVsdGFYICogMjtcclxuICAgICAgICBhbmdsZVggKz0gZS5kZWx0YVkgKiAyO1xyXG4gICAgICAgIGFuZ2xlWCA9IE1hdGgubWF4KC05MCwgTWF0aC5taW4oOTAsIGFuZ2xlWCkpO1xyXG4gICAgICAgIHRoYXQuZ2wub25kcmF3KCk7XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSBpZiAoZS5idXR0b25zPT0yKSB7XHJcbiAgICAgICAgZGVwdGggLT0gZS5kZWx0YVk7XHJcbiAgICAgICAgdGhhdC5nbC5vbmRyYXcoKTtcclxuXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9O1xyXG5cclxuICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgZ2wub25kcmF3ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgZ2wubWFrZUN1cnJlbnQoKTtcclxuXHJcbiAgICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XHJcbiAgICBnbC5sb2FkSWRlbnRpdHkoKTtcclxuICAgIGdsLnRyYW5zbGF0ZSgwLCAwLCAtZGVwdGgpO1xyXG4gICAgZ2wucm90YXRlKGFuZ2xlWCwgMSwgMCwgMCk7XHJcbiAgICBnbC5yb3RhdGUoYW5nbGVZLCAwLCAxLCAwKTtcclxuXHJcbiAgICBpZiAoIVZpZXdlci5saW5lT3ZlcmxheSkgZ2wuZW5hYmxlKGdsLlBPTFlHT05fT0ZGU0VUX0ZJTEwpO1xyXG5cclxuICAgIHRoYXQubWVzaC5mb3JFYWNoKG0gPT4gdGhhdC5saWdodGluZ1NoYWRlci5kcmF3KG0sIGdsLlRSSUFOR0xFUykpO1xyXG4gICAgaWYgKCFWaWV3ZXIubGluZU92ZXJsYXkpIGdsLmRpc2FibGUoZ2wuUE9MWUdPTl9PRkZTRVRfRklMTCk7XHJcblxyXG4gICAgaWYgKFZpZXdlci5saW5lT3ZlcmxheSkgZ2wuZGlzYWJsZShnbC5ERVBUSF9URVNUKTtcclxuICAgIGdsLmVuYWJsZShnbC5CTEVORCk7XHJcbiAgICB0aGF0Lm1lc2guZm9yRWFjaChtID0+IHRoYXQuYmxhY2tTaGFkZXIuZHJhdyhtLCBnbC5MSU5FUykpO1xyXG4gICAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XHJcbiAgICBpZiAoVmlld2VyLmxpbmVPdmVybGF5KSBnbC5lbmFibGUoZ2wuREVQVEhfVEVTVCk7XHJcbiAgfTtcclxuXHJcbiAgZ2wub25kcmF3KCk7XHJcbn1cclxuXHJcbnZhciBuZXh0SUQgPSAwO1xyXG5WaWV3ZXIuYWRkVmlld2VyPWZ1bmN0aW9uKHZpZXdlcikge1xyXG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKG5leHRJRCsrKS5hcHBlbmRDaGlsZCh2aWV3ZXIuZ2wuY2FudmFzKTtcclxufVxyXG5tb2R1bGUuZXhwb3J0cyA9IFZpZXdlciJdfQ==
