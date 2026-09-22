"""Small, editable clay modeling recipes used by the Pecu card collection."""
import math
import random
import bpy
from mathutils import Vector

TAU = math.tau
M = {}


def material(name, color, metal=0, rough=.65, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Subsurface Weight'].default_value = .035 if not metal else 0
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 23
    noise.inputs['Detail'].default_value = 3.5
    noise.inputs['Roughness'].default_value = .72
    bump = m.node_tree.nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .24
    bump.inputs['Distance'].default_value = .026
    m.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
    m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m


def palette():
    colors = {
        'cream': (.91,.80,.59), 'ivory': (.98,.92,.77), 'brown': (.17,.065,.029),
        'sage': (.27,.40,.17), 'leaf': (.40,.56,.18), 'forest': (.055,.16,.095),
        'mint': (.37,.65,.52), 'coral': (.9,.23,.13), 'pink': (.87,.40,.47),
        'blush': (.91,.58,.53), 'lilac': (.48,.34,.64), 'lavender': (.68,.56,.78),
        'plum': (.15,.072,.23), 'indigo': (.14,.18,.34), 'sky': (.29,.54,.72),
        'teal': (.055,.29,.33), 'ice': (.60,.78,.87), 'snow': (.92,.97,1),
        'sand': (.67,.44,.22), 'ochre': (.78,.43,.10), 'yellow': (1,.71,.12),
        'red': (.68,.07,.065), 'burgundy': (.31,.055,.067), 'wood': (.34,.14,.057),
        'terracotta': (.62,.22,.12), 'dark': (.025,.022,.023), 'gold': (.93,.57,.12),
    }
    M.clear()
    for name, color in colors.items():
        M[name] = material('Clay / '+name, color, metal=.35 if name=='gold' else 0)
    M['lamp'] = material('Clay / warm lamp', (1,.63,.19), glow=.8)
    return M


def finish(o, name, mat):
    o.name = name
    o.data.materials.append(M.get(mat,mat) if isinstance(mat,str) else mat)
    if o.type == 'MESH':
        for f in o.data.polygons:
            f.use_smooth = True
    return o


def sphere(name, pos, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, location=pos)
    o=finish(bpy.context.object,name,mat)
    o.scale=scale
    return o


def box(name,pos,size,mat,rounding=.12):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    o=finish(bpy.context.object,name,mat)
    o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=o.modifiers.new('Rounded clay edges','BEVEL')
    bevel.width=rounding
    bevel.segments=5
    o.modifiers.new('Soft corner normals','WEIGHTED_NORMAL')
    return o


def mesh(name,vertices,faces,mat,bevel=.0):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces)
    data.update()
    o=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(o)
    finish(o,name,mat)
    if bevel:
        m=o.modifiers.new('Soft clay edges','BEVEL');m.width=bevel;m.segments=3
        o.modifiers.new('Normals','WEIGHTED_NORMAL')
    return o


def profile(name,points,pos,depth,mat,bevel=.035):
    x,y,z=pos
    n=len(points)
    verts=[(x+a,y+d,z+b) for d in [-depth/2,depth/2] for a,b in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,bevel)


def line(name,pts,radius,mat,closed=False):
    d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=12
    d.bevel_depth=radius;d.bevel_resolution=3;d.use_fill_caps=True
    sp=d.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
    for p,co in zip(sp.bezier_points,pts):
        p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    sp.use_cyclic_u=closed
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o)
    return finish(o,name,mat)


def disk(name,pos,radius,depth,mat,vertical=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,
        location=pos,rotation=(math.pi/2,0,0) if vertical else (0,0,0))
    o=finish(bpy.context.object,name,mat)
    m=o.modifiers.new('Rolled edge','BEVEL');m.width=min(.045,depth*.25);m.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o


def ring(name,pos,radius,tube,mat,vertical=True):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius,minor_radius=tube,
        major_segments=48,minor_segments=12,location=pos,
        rotation=(math.pi/2,0,0) if vertical else (0,0,0))
    return finish(bpy.context.object,name,mat)


def star(name,pos,radius,mat='gold',points=5):
    return profile(name,[(math.cos(math.pi/2+i*math.pi/points)*radius*(1 if i%2==0 else .47),
        math.sin(math.pi/2+i*math.pi/points)*radius*(1 if i%2==0 else .47)) for i in range(points*2)],pos,.13,mat,.045)


def moon(name,pos,radius,mat='yellow',angle=0):
    # Two matched arcs form a strip; explicit quads avoid concave ngon artifacts.
    outer=[(radius*math.cos(a),radius*math.sin(a)) for a in [math.pi/3+i*4*math.pi/3/48 for i in range(49)]]
    inner=[(radius*(.5+.8660254*math.cos(a)),radius*.8660254*math.sin(a)) for a in [math.pi/2+i*math.pi/48 for i in range(49)]]
    x,y,z=pos
    verts=[]
    for d in [-.12,.12]:
        for arc in [outer,inner]:
            verts.extend((x+u*math.cos(angle)-v*math.sin(angle),y+d,z+u*math.sin(angle)+v*math.cos(angle)) for u,v in arc)
    faces=[]
    for i in range(48):
        faces.extend([(i,i+1,50+i,49+i),(98+i,147+i,148+i,99+i),
                      (i,98+i,99+i,i+1),(49+i,50+i,148+i,147+i)])
    faces.extend([(0,49,147,98),(48,146,195,97)])
    return mesh(name,verts,faces,mat,.035)


def leaf(name,pos,length,width,angle=0,mat='leaf'):
    x,y,z=pos
    verts=[]
    for j in range(13):
        t=j/12
        for k in range(5):
            u=(k-2)/2
            a=u*width*math.sin(math.pi*t)**.75
            b=t*length
            yy=y-.09*math.sin(math.pi*t)*(1-u*u)
            verts.append((x+a*math.cos(angle)+b*math.sin(angle),yy,z-a*math.sin(angle)+b*math.cos(angle)))
    faces=[(j*5+k,j*5+k+1,(j+1)*5+k+1,(j+1)*5+k) for j in range(12) for k in range(4)]
    o=mesh(name,verts,faces,mat)
    solid=o.modifiers.new('Clay leaf thickness','SOLIDIFY');solid.thickness=.045
    sub=o.modifiers.new('Smooth leaf','SUBSURF');sub.levels=1
    line(name+' vein',[(x,y-.015,z),(x+.5*length*math.sin(angle),y-.13,z+.5*length*math.cos(angle)),
        (x+.94*length*math.sin(angle),y-.045,z+.94*length*math.cos(angle))],.014,'sage')
    return o


def flower(name,pos,radius=.3,petal='ivory',center='yellow',petals=7):
    x,y,z=pos
    for i in range(petals):
        a=TAU*i/petals
        o=sphere(name+' petal',(x+math.sin(a)*radius*.6,y,z+math.cos(a)*radius*.6),
            (radius*.27,.10,radius*.54),petal);o.rotation_euler.y=a
    sphere(name+' center',(x,y-.13,z),(radius*.25,.13,radius*.25),center)


def cloud(name,pos,scale=1,mat='ivory'):
    x,y,z=pos
    for dx,dz,r in [(-.62,0,.36),(-.23,.18,.46),(.2,.28,.49),(.65,.04,.34),(0,-.13,.42)]:
        sphere(name,(x+dx*scale,y,z+dz*scale),(r*scale,.27*scale,r*.8*scale),mat)


def grass(pos,spread=.7,count=10):
    x,y,z=pos
    for i in range(count):
        dx=random.uniform(-spread,spread)
        sphere('Moss',(x+dx,y+random.uniform(-.15,.15),z+random.uniform(0,.12)),
            (random.uniform(.08,.18),.14,random.uniform(.08,.17)),'sage' if i%3==0 else 'leaf')


def mushroom(name,pos,scale=1,mat='coral'):
    x,y,z=pos
    sphere(name+' stem',(x,y,z+.43*scale),(.17*scale,.17*scale,.48*scale),'cream')
    sphere(name+' cap',(x,y,z+.84*scale),(.57*scale,.40*scale,.25*scale),mat)
    for dx,dz in [(-.27,.03),(.13,.13),(.33,-.03),(-.05,-.1)]:
        sphere(name+' spot',(x+dx*scale,y-.34*scale,z+(.84+dz)*scale),(.08*scale,.024*scale,.055*scale),'ivory')


def pot(name,pos,scale=.6):
    x,y,z=pos
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.25*scale,radius2=.37*scale,depth=.5*scale,location=(x,y,z+.25*scale))
    finish(bpy.context.object,name+' pot','terracotta')
    ring(name+' rim',(x,y,z+.52*scale),.35*scale,.055*scale,'terracotta',False)
    disk(name+' soil',(x,y,z+.51*scale),.32*scale,.025,'brown',False)
    for a,l in [(-.8,.8),(.6,1.0),(0,1.15)]:leaf(name+' leaf',(x,y-.05,z+.51*scale),l*scale,.22*scale,a)


def cup(name,pos,scale=1,drink='brown'):
    x,y,z=pos
    sphere(name+' bowl',(x,y,z+.28*scale),(.34*scale,.31*scale,.32*scale),'cream')
    ring(name+' lip',(x,y,z+.47*scale),.28*scale,.055*scale,'cream',False)
    disk(name+' drink',(x,y,z+.46*scale),.245*scale,.025,drink,False)
    ring(name+' handle',(x+.34*scale,y,z+.3*scale),.17*scale,.052*scale,'cream')
    line(name+' steam',[(x,y,z+.7*scale),(x-.13*scale,y,z+.95*scale),(x+.12*scale,y,z+1.15*scale),(x,y,z+1.4*scale)],.025*scale,'ivory')


def book(name,pos,size,mat='burgundy',tilt=0):
    x,y,z=pos;w,d,h=size
    objects=[box(name+' pages',pos,(w*.9,d*.84,h*.9),'cream',.03),
        box(name+' cover',(x,y-d*.47,z),(w,d*.10,h),mat,.035),
        box(name+' back',(x,y+d*.47,z),(w,d*.10,h),mat,.035),
        box(name+' spine',(x-w*.48,y,z),(w*.12,d,h),mat,.045)]
    for zz in [-.32,.32]:box(name+' gilt',(x,y-d*.535,z+h*zz),(w*.75,.026,.045),'gold',.01)
    if tilt:
        for o in objects:
            q=o.location-Vector(pos);q.rotate(__import__('mathutils').Euler((0,tilt,0)));o.location=Vector(pos)+q;o.rotation_euler.y+=tilt
    return objects


def crystal(name,pos,height,mat='ice',radius=.24):
    x,y,z=pos
    verts=[(x+radius*math.cos(i*TAU/6),y+radius*math.sin(i*TAU/6),z+h) for h in [0,height*.72] for i in range(6)]
    verts.append((x+.04,y,z+height))
    faces=[tuple(reversed(range(6)))]+[(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)]+[(6+i,6+(i+1)%6,12) for i in range(6)]
    o=mesh(name,verts,faces,mat,.018)
    for f in o.data.polygons:f.use_smooth=False
    return o


def coin(name,pos,r=.23):
    disk(name,pos,r,.07,'gold')
    x,y,z=pos
    profile(name+' diamond',[(0,r*.6),(r*.3,0),(0,-r*.5),(-r*.3,0)],(x,y-.05,z),.02,'ochre',.005)


def text(name,body,pos,size,mat='brown'):
    d=bpy.data.curves.new(name,'FONT');d.body=body;d.size=size;d.extrude=.02;d.bevel_depth=.009;d.bevel_resolution=3;d.align_x='CENTER'
    font=bpy.data.fonts.get('Arial Rounded Bold.ttf')
    if not font:font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf')
    d.font=font
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);o.location=pos;o.rotation_euler=(math.pi/2,0,0)
    return finish(o,name,mat)
