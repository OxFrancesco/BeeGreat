"""Saturated yellow palette shared by the source model and app renders."""
PALETTE = {
    'Orange': '#FFD500', 'OrangeLight': '#FFE600', 'OrangeShadow': '#EAB600',
    'OrangeDeep': '#C58D00', 'Yellow_pixel_light': '#FFDC00', 'Yellow_pixel_shadow': '#DBA500',
    'Ink': '#171006', 'InkSoft': '#211609', 'InkHighlight': '#34250C',
    'Stripe': '#2B1907', 'Brown': '#3E2408', 'BrownLight': '#68400C',
    'Blush': '#FF795B', 'White': '#F8FCFF', 'WingGrey': '#D9E8ED',
    'WingShadow': '#A8C4CE', 'WingTan': '#F4EABF', 'Backdrop': '#F3F1E9', 'Floor': '#ECE9DF',
}
YELLOWS = {'Orange', 'OrangeLight', 'OrangeShadow', 'OrangeDeep', 'Yellow_pixel_light', 'Yellow_pixel_shadow'}
DARKS = {'Ink', 'InkSoft', 'InkHighlight', 'Stripe', 'Brown', 'BrownLight'}


def apply_materials():
    import bpy
    from build_bee import hex_rgba
    for name, color in PALETTE.items():
        material = bpy.data.materials.get(name)
        if not material:
            continue
        material.diffuse_color = hex_rgba(color)
        shader = material.node_tree.nodes.get('Principled BSDF')
        if not shader:
            continue
        shader.inputs['Base Color'].default_value = hex_rgba(color)
        if name in YELLOWS:
            shader.inputs['Emission Color'].default_value = hex_rgba(color)
            shader.inputs['Emission Strength'].default_value = .22
            shader.inputs['Specular IOR Level'].default_value = .08
        elif name in DARKS:
            shader.inputs['Specular IOR Level'].default_value = .04
