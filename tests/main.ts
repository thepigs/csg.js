import { Line, extrude, translate, rotate } from "./more"
import CSG = require('./csg.js')
import Viewer = require("./viewer.js")

console.log(Viewer)

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

}
function box_contour(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new Line(width / 2, 0).line(0, hc / 2).arc({ rx: radius }).line(-wc, 0).arc({ rx: radius, start: Math.PI / 2 }).line(0, -hc).arc({ rx: radius, start: Math.PI }).line(wc, 0).arc({ rx: radius, start: Math.PI * 1.5 })
    return pl.toPolygon();
}

function box_contour3(width, height, radius) {
    var hc = height - 2 * radius;
    var wc = width - 2 * radius;
    var pl = new Line(width / 2, 0).line(0, hc / 2).line(-radius, radius).line(-wc, 0).line(-radius, -radius).line(0, -hc).line(radius, -radius).line(wc, 0).line(radius, radius)
    return pl.toPolygon();
}


function make_mount(loc) {
    var md = box.mount;
    var i = box.outline;
    var th = box.thickness.body.base +md.height;
    var m = new Line(md.radius, 0).arc({ rx: md.radius, arc: 2 * Math.PI, slices: 24 }).toPolygon()
    var mc = extrude(m, [0, 0, th]);
    var hole = new Line(md.hole.outer_radius, 0).arc({ rx: md.hole.outer_radius, arc: 2 * Math.PI, slices: 6 }).toPolygon()
    var holep = extrude(hole, [0, 0, md.hole.height]);
    hole = new Line(md.hole.inner_radius, 0).arc({ rx: md.hole.inner_radius, arc: 2 * Math.PI, slices: 12 })
        .toPolygon()
    holep = holep.union(extrude(hole, [0, 0, th]));
    translate(mc, loc);
    translate(holep, loc);

    return [mc,holep];
    
}


function make_lid_mount(body:CSG,loc:CSG.Vector) {
    var md = box.lid_mount;
    var i = box.outline;
    var m =  Line.rect(md.radius).toPolygon()
    var m = extrude(m, [0, 0, md.height]);
    var hole = Line.circle(md.hole.radius).toPolygon()
    var holep = extrude(hole, [0, 0, md.height]);
    var axis = new CSG.Vector(0,1,0)
    m=rotate(m,90,axis)
    holep=rotate(holep,90,axis)
    translate(m,loc)
    translate(holep,loc)
    return body.union(m).subtract(holep);
}

function add_mounts(body) {
    var md = box.mount;
    var i = box.outline;
    md.locations.forEach(l => {
        var m = make_mount([(l.x > 0 ? -1 : 1) * i.width / 2 + l.x, (l.y > 0 ? -1 : 1) * i.depth / 2 + l.y, 0]);
        body = body.union(m[0])
        body = body.subtract(m[1]);        
    });
    var i = box.internal
    var ld = box.lid_mount;

    var h = i.height - ld.radius-box.thickness.lid.outer;
    
    body=make_lid_mount(body, new CSG.Vector(-i.width/2,0,h))
    body=make_lid_mount(body, new CSG.Vector(i.width/2-ld.height,0,h))
    return body;
}
function outline() {
    var i = box.outline
    var poly = new Line(i.width / 2, 0).line(0, i.depth / 2).line(-i.width, 0).line(0, -i.depth).line(i.width, 0).line(0, i.depth / 2).toPolygon({ z: 10 });
    return CSG.fromPolygons([poly]);
}
function body() {

    var i = box.internal
    var tb = box.thickness.body
    var tl = box.thickness.lid
    var cr = box.other.corner_radius;

    var outer = extrude(box_contour(i.width, i.depth, cr), [0, 0, i.height]);
    var inner = extrude(box_contour(i.width - tb.wall * 2, i.depth - tb.wall * 2, cr - tb.wall / 2), [0, 0, i.height - tb.base]);

    translate(inner, [0, 0, tb.base])
    var shell = outer.subtract(inner);

    // cut out lid slot
    var lid_outer = extrude(box_contour(i.width - tb.wall, i.depth - tb.wall, cr), [0, 0, tl.outer]);
    translate(lid_outer, [0, 0, i.height - tl.outer])
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

Viewer.addViewer(new Viewer([body()/*,outline()*/], 500, 500, 500));