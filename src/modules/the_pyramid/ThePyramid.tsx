import { CircularProgress } from "@mui/material";
import React, { useEffect, useState } from "react";
import Tree from "react-d3-tree";
import { RawNodeDatum } from "react-d3-tree/lib/types/common";
import { uniqueNamesGenerator, names } from "unique-names-generator";

interface TreeNode extends RawNodeDatum {
    name: string;
    attributes?: Record<string, string | number | boolean>;
    children?: TreeNode[];
}

interface Pyramid extends RawNodeDatum {
    name: string;
    children: TreeNode[];
    attributes: Record<string, string | number | boolean>;
}

const LEFT = 0;
const CENTER = 1;
const RIGHT = 2;
const CHILDREN_SIZE = 3;
// This is a simplified example of an org chart with a depth of 2.
// Note how deeper levels are defined recursively via the `children` property.
const orgChartMock: Pyramid = {
    name: "CEO",
    attributes: {},
    children: [
        {
            name: "Manager",
            attributes: {
                money: 500,
            },
            children: [
                {
                    name: "Foreman",
                    attributes: {
                        department: "Fabrication",
                    },
                    children: [
                        {
                            name: "Worker",
                        },
                    ],
                },
                {
                    name: "Foreman",
                    attributes: {
                        department: "Assembly",
                    },
                    children: [
                        {
                            name: "Worker",
                        },
                    ],
                },
            ],
        },
    ],
};

const ThePyramid = () => {
    const [orgChart, setOrgChart] = useState<Pyramid>({
        name: "First Pyramid",
        attributes: {},
        children: [],
    });

    function getDefaultAttributes() {
        return {
            money: 500,
        };
    }

    function generatePerson(): TreeNode {
        return {
            attributes: {
                money: 500
            },
            name: uniqueNamesGenerator({
                dictionaries: [names],
                length: 1,
            }),
        };
    }

    function initializeChildren(children: TreeNode[] | undefined) {
        const newChildren = [];
        if (children?.length !== CHILDREN_SIZE) {
            newChildren.push({
                name: "",
            });
            newChildren.push({
                name: "",
            });
            newChildren.push({
                name: "",
            });

            return newChildren;
        } else {
            return children;
        }
    }

    function addPersonToTree(person: TreeNode, pyramid: TreeNode | Pyramid) {
        const random = Math.floor(Math.random() * 11);
        const left = random < 5;

        pyramid.children = initializeChildren(pyramid.children);

        const leftFull = childOccupied(pyramid.children[LEFT]);
        const centerFull = childOccupied(pyramid.children[CENTER]);
        const rightFull = childOccupied(pyramid.children[RIGHT]);
        if (left) {
            if (!leftFull) {
                pyramid.children[LEFT] = person;
            } else if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!rightFull) {
                pyramid.children[RIGHT] = person;
            } else {
                addPersonToTree(person, pyramid.children[LEFT]);
            }
        } else {
            if (!rightFull) {
                pyramid.children[RIGHT] = person;
            } else if (!centerFull) {
                pyramid.children[CENTER] = person;
            } else if (!leftFull) {
                pyramid.children[LEFT] = person;
            } else {
                addPersonToTree(person, pyramid.children[RIGHT]);
            }
        }
    }

    function childOccupied(childNode: TreeNode) {
        return childNode.name.length !== 0;
    }

    useEffect(() => {
        const numOfPeople = 50;
        const initialOrg: Pyramid = {
            name: "First Org",
            attributes: {},
            children: [],
        };
        for (let index = 0; index < numOfPeople; index++) {
            const person = generatePerson();
            addPersonToTree(person, initialOrg);
        }

        setOrgChart(initialOrg);
        console.log(orgChart);
    }, []);

    return (
        // `<Tree />` will fill width/height of its container; in this case `#treeWrapper`.
        <div id="treeWrapper" style={{ width: "100%", height: "60vh" }}>
            {orgChart.children.length > 0 ? <Tree data={orgChart} orientation="vertical" /> : <CircularProgress />}
        </div>
    );
};

export default ThePyramid;
