import { connect } from '../../common/store/store-connector';
import { useAppDispatch } from '../../common/store';
import { isEdge, isGroup, isPolygon, SelectedGroup, SingleSelectableElement } from '../../common/selection/selectable';
import { IEdge } from '../../common/geometry/edge';
import { IEntityKey } from '../../common/geometry/entity';
import { IPolygon } from '../../common/geometry/polygon';
import { adaptEdges, adaptPolygonSurfaces } from '../../common/store/walls';
import DirectedMaterialEditorComponent from './directed-material.component';
import MaterialEditorComponent from './materialEditorComponent';
import { cloneMaterial, IMaterial } from '../../common/geometry/properties';

const template = document.createElement('template');
template.innerHTML =  /*html*/`
<style>
:host {
    display: block;
    font-family: monospace;
    font-size: 11px;
    color: #ccc;
}
:host([hidden]) {
    display: none;
}
.row {
    display: flex;
    align-items: center;
    padding: 1px 0;
    gap: 4px;
}
.label {
    color: #aaa;
    min-width: 6em;
}
.value {
    color: #eee;
}
.section {
    margin-bottom: 6px;
}
.section-label {
    color: #999;
    font-size: 10px;
    text-transform: uppercase;
    margin-bottom: 2px;
    margin-top: 6px;
}
input[type="checkbox"] {
    accent-color: #42a5f5;
}
</style>
<div class="section">
    <div class="row"><span class="label">elements:</span><span id="element_count" class="value"></span></div>
    <div class="row"><span class="label">edges:</span><span id="edge_count" class="value"></span></div>
</div>
<div class="section">
    <div class="row"><span class="label">immaterial:</span><input id="immaterial" type="checkbox" /></div>
</div>
<div class="section">
    <div class="section-label">Material</div>
    <directed-material-editor id="material"></directed-material-editor>
</div>
<div class="section">
    <div class="section-label">Floor</div>
    <div class="row"><span class="label">enabled:</span><input id="floor_enabled" type="checkbox" /></div>
    <material-editor id="floor_material"></material-editor>
</div>
<div class="section">
    <div class="section-label">Ceiling</div>
    <div class="row"><span class="label">enabled:</span><input id="ceiling_enabled" type="checkbox" /></div>
    <material-editor id="ceiling_material"></material-editor>
</div>
`;

const dispatch = useAppDispatch();

export default class GroupEditorComponent extends HTMLElement {
    private _group: SelectedGroup;
    private elementCountElement: HTMLElement;
    private edgeCountElement: HTMLElement;
    private immaterialElement: HTMLInputElement;
    private materialElement: DirectedMaterialEditorComponent;
    private floorEnabledElement: HTMLInputElement;
    private floorMaterialElement: MaterialEditorComponent;
    private ceilingEnabledElement: HTMLInputElement;
    private ceilingMaterialElement: MaterialEditorComponent;

    constructor() {
        super();
        const shadowRoot = this.attachShadow({mode: 'closed'});
        shadowRoot.appendChild(template.content.cloneNode(true));

        this.elementCountElement = <HTMLElement>shadowRoot.querySelector('#element_count');
        this.edgeCountElement = <HTMLElement>shadowRoot.querySelector('#edge_count');
        this.immaterialElement = <HTMLInputElement>shadowRoot.querySelector('#immaterial');
        this.materialElement = <DirectedMaterialEditorComponent>shadowRoot.querySelector('#material');
        this.floorEnabledElement = <HTMLInputElement>shadowRoot.querySelector('#floor_enabled');
        this.floorMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#floor_material');
        this.ceilingEnabledElement = <HTMLInputElement>shadowRoot.querySelector('#ceiling_enabled');
        this.ceilingMaterialElement = <MaterialEditorComponent>shadowRoot.querySelector('#ceiling_material');

        this.immaterialElement.addEventListener('change', (event) => {
            this.adaptAllEdges(_ => {
                _.immaterial = (<HTMLInputElement>event.target).checked;
                return _;
            });
        });

        this.materialElement.addEventListener('change', this.changeMaterial);

        this.floorEnabledElement.addEventListener('change', () => {
            if (!this._group) return;
            for (const polygon of this.getPolygons()) {
                if (this.floorEnabledElement.checked) {
                    const material: IMaterial = polygon.floorMaterial ?? { color: [128, 128, 128, 1] };
                    dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, floorMaterial: material }));
                } else {
                    dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, floorMaterial: null }));
                }
            }
        });

        this.floorMaterialElement.addEventListener('change', () => {
            if (!this._group) return;
            for (const polygon of this.getPolygons()) {
                dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, floorMaterial: this.floorMaterialElement.material }));
            }
        });

        this.ceilingEnabledElement.addEventListener('change', () => {
            if (!this._group) return;
            for (const polygon of this.getPolygons()) {
                if (this.ceilingEnabledElement.checked) {
                    const material: IMaterial = polygon.ceilingMaterial ?? { color: [128, 128, 128, 1] };
                    dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, ceilingMaterial: material }));
                } else {
                    dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, ceilingMaterial: null }));
                }
            }
        });

        this.ceilingMaterialElement.addEventListener('change', () => {
            if (!this._group) return;
            for (const polygon of this.getPolygons()) {
                dispatch(adaptPolygonSurfaces({ polygonId: polygon.id, ceilingMaterial: this.ceilingMaterialElement.material }));
            }
        });

        connect(state => {
            const sources = state.textures?.sources ?? [];
            this.materialElement.selectableTextures = sources;
            this.floorMaterialElement.selectableTextures = sources;
            this.ceilingMaterialElement.selectableTextures = sources;
            const selectedElement = state.selection.treeSelection;
            if (isGroup(selectedElement)) {
                this.updateGroup(selectedElement);
            }
        });
    }

    private changeMaterial = (_: Event) => {
        this.adaptAllEdges(_ => {
            _.material = this.materialElement.material;
            return _;
        });
    }

    private adaptAllEdges = (transformer: ((edge: IEdge) => IEdge)): void => {
        if (!this._group) return;
        dispatch(adaptEdges({
            edgeMap: this.buildEdgeMap(this._group.elements),
            transformer
        }));
    };

    private buildEdgeMap(elements: SingleSelectableElement[]): Map<IEntityKey, IEdge[]> {
        return elements.reduce((acc, s) => {
            const polygonId = s.polygon.id;
            const edges = isEdge(s) ? [s.edge]
                : isPolygon(s) ? s.polygon.edges
                : [];
            if (edges.length === 0) return acc;
            const existing = acc.get(polygonId) || [];
            return acc.set(polygonId, Array.from(new Set<IEdge>([...existing, ...edges])));
        }, new Map<IEntityKey, IEdge[]>());
    }

    private getPolygons(): IPolygon[] {
        const seen = new Set<IEntityKey>();
        const polygons: IPolygon[] = [];
        for (const el of this._group.elements) {
            const polygon = el.polygon;
            if (!seen.has(polygon.id)) {
                seen.add(polygon.id);
                polygons.push(polygon);
            }
        }
        return polygons;
    }

    public updateGroup(group: SelectedGroup) {
        if (this._group !== group) {
            this._group = group;
            this.render();
        }
    }

    private render() {
        const edgeMap = this.buildEdgeMap(this._group.elements);
        const totalEdges = Array.from(edgeMap.values()).reduce((sum, edges) => sum + edges.length, 0);
        this.elementCountElement.innerText = String(this._group.elements.length);
        this.edgeCountElement.innerText = String(totalEdges);

        // Show material from first available edge
        const firstEdge = this.findFirstEdge();
        if (firstEdge) {
            this.immaterialElement.checked = firstEdge.immaterial ?? false;
            this.materialElement.material = firstEdge.material;
        }

        // Show floor/ceiling from first polygon
        const firstPolygon = this.findFirstPolygon();
        if (firstPolygon) {
            const hasFloor = firstPolygon.floorMaterial != null;
            this.floorEnabledElement.checked = hasFloor;
            if (hasFloor) {
                this.floorMaterialElement.material = firstPolygon.floorMaterial;
                this.floorMaterialElement.hidden = false;
            } else {
                this.floorMaterialElement.hidden = true;
            }

            const hasCeiling = firstPolygon.ceilingMaterial != null;
            this.ceilingEnabledElement.checked = hasCeiling;
            if (hasCeiling) {
                this.ceilingMaterialElement.material = firstPolygon.ceilingMaterial;
                this.ceilingMaterialElement.hidden = false;
            } else {
                this.ceilingMaterialElement.hidden = true;
            }
        } else {
            this.floorEnabledElement.checked = false;
            this.floorMaterialElement.hidden = true;
            this.ceilingEnabledElement.checked = false;
            this.ceilingMaterialElement.hidden = true;
        }
    }

    private findFirstEdge(): IEdge | null {
        for (const el of this._group.elements) {
            if (isEdge(el)) return el.edge;
            if (isPolygon(el) && el.polygon.edges.length > 0) return el.polygon.edges[0];
        }
        return null;
    }

    private findFirstPolygon(): IPolygon | null {
        for (const el of this._group.elements) {
            if (isPolygon(el)) return el.polygon;
            if (isEdge(el)) return el.polygon;
        }
        return null;
    }
}

window.customElements.define('group-editor', GroupEditorComponent);
